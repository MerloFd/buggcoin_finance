// Debt math. Everything here is derived from records that already exist —
// nothing about a debt is stored beyond the commitment itself.
//
// Two shapes of debt:
//   - installment: a Recurring whose `end.kind === 'after'` ("12x de R$ 350")
//   - open: a `Debt` row with no schedule ("R$ 2.000 to my brother")

import { dayOfMonthOf } from "@/lib/recurring";
import type {
  Debt,
  Direction,
  Entry,
  Recurring,
  RecurringRealization,
} from "@/lib/store/types";

// --- month helpers (month = 'YYYY-MM') ---

function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const zeroBased = year * 12 + (monthNumber - 1) + count;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export interface InstallmentDebt {
  recurring: Recurring;
  creditor: string;
  description: string;
  amount: number; // this month's instalment
  total: number; // how many instalments in all
  totalAmount: number; // amount * total
  paid: number; // how many are already paid (strict rule below)
  remaining: number; // how many are left
  remainingAmount: number; // amount * remaining
  dueDay: number; // day of the month it falls on
  currentIndex: number | null; // which instalment lands on the reference month
  endsOn: string; // 'YYYY-MM' of the last instalment — "quando acaba"
}

/**
 * Whether the instalment due in `month` counts as paid.
 *
 * Strict rule (chosen by the user over "it came due, so it's paid"):
 *   - realization `confirmed` or `assumed`  -> paid
 *   - past month with no realization        -> paid (assumed, same semantics
 *                                              as the lazy month closing)
 *   - realization `pending`                 -> not yet (waiting on the user)
 *   - current month with no realization     -> not yet
 *
 * Derived on read on purpose: the lazy month closing only writes rows for
 * months the user actually opens in Histórico, so counting stored rows would
 * make the number depend on where the user happened to browse.
 */
function isOccurrencePaid(
  month: string,
  currentMonth: string,
  realizationByMonth: Map<string, RecurringRealization>,
): boolean {
  const realization = realizationByMonth.get(month);
  if (realization) {
    return realization.status === "confirmed" || realization.status === "assumed";
  }
  return month < currentMonth;
}

export function describeInstallment(
  recurring: Recurring,
  realizations: RecurringRealization[],
  referenceMonth: string,
  currentMonth: string,
): InstallmentDebt | null {
  if (recurring.end.kind !== "after") return null;

  const step = recurring.frequency === "yearly" ? 12 : 1;
  const total = recurring.end.occurrences;
  const startMonth = recurring.startDate.slice(0, 7);

  const realizationByMonth = new Map(
    realizations
      .filter((r) => r.recurringId === recurring.id)
      .map((r) => [r.month, r]),
  );

  let paid = 0;
  let currentIndex: number | null = null;
  for (let i = 0; i < total; i += 1) {
    const month = addMonths(startMonth, i * step);
    if (isOccurrencePaid(month, currentMonth, realizationByMonth)) paid += 1;
    if (month === referenceMonth) currentIndex = i + 1;
  }

  const remaining = total - paid;
  return {
    recurring,
    creditor: recurring.creditor ?? "Sem credor",
    description: recurring.description,
    amount: recurring.amount,
    total,
    totalAmount: recurring.amount * total,
    paid,
    remaining,
    remainingAmount: recurring.amount * remaining,
    dueDay: dayOfMonthOf(recurring, referenceMonth),
    currentIndex,
    endsOn: addMonths(startMonth, (total - 1) * step),
  };
}

/** Every instalment debt: active expense recurrings that end after N times. */
export function installmentDebts(
  recurrings: Recurring[],
  directionOf: (r: Recurring) => Direction,
  realizations: RecurringRealization[],
  referenceMonth: string,
  currentMonth: string,
): InstallmentDebt[] {
  return recurrings
    .filter((r) => r.active && r.end.kind === "after" && directionOf(r) === "out")
    .map((r) => describeInstallment(r, realizations, referenceMonth, currentMonth))
    .filter((d): d is InstallmentDebt => d !== null)
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
}

export interface DueInstallment {
  recurringId: string;
  creditor: string;
  description: string;
  dueDate: string; // ISO date
  amount: number;
  index: number; // which instalment this is
  total: number;
  remainingAfter: number; // still owed once this one is paid
}

/**
 * Instalments falling due inside an arbitrary date window — what the chart's
 * detail sheet shows when you click a bucket.
 *
 * Works for any window, past or future, because the whole schedule is derived
 * from `startDate` + `frequency` + `end`. Navigating to a future month answers
 * "quanto vou dever lá" without anything being stored.
 */
export function installmentsDueBetween(
  recurrings: Recurring[],
  directionOf: (r: Recurring) => Direction,
  start: string,
  end: string,
): DueInstallment[] {
  const due: DueInstallment[] = [];

  for (const recurring of recurrings) {
    if (!recurring.active) continue;
    if (recurring.end.kind !== "after") continue;
    if (directionOf(recurring) !== "out") continue;

    const step = recurring.frequency === "yearly" ? 12 : 1;
    const total = recurring.end.occurrences;
    const startMonth = recurring.startDate.slice(0, 7);

    for (let i = 0; i < total; i += 1) {
      const month = addMonths(startMonth, i * step);
      const day = String(dayOfMonthOf(recurring, month)).padStart(2, "0");
      const dueDate = `${month}-${day}`;
      if (dueDate < start || dueDate > end) continue;

      due.push({
        recurringId: recurring.id,
        creditor: recurring.creditor ?? "Sem credor",
        description: recurring.description,
        dueDate,
        amount: recurring.amount,
        index: i + 1,
        total,
        remainingAfter: recurring.amount * (total - (i + 1)),
      });
    }
  }

  return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface OpenDebt {
  debt: Debt;
  paidAmount: number;
  remainingAmount: number;
}

/** Open debts with their balance derived from the entries that paid them. */
export function openDebts(debts: Debt[], entries: Entry[]): OpenDebt[] {
  const paidByDebt = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.paysDebtId) continue;
    paidByDebt.set(
      entry.paysDebtId,
      (paidByDebt.get(entry.paysDebtId) ?? 0) + Math.abs(entry.amount),
    );
  }

  return debts
    .filter((d) => !d.settledAt)
    .map((debt) => {
      const paidAmount = paidByDebt.get(debt.id) ?? 0;
      return {
        debt,
        paidAmount,
        // Never negative: overpaying settles it, it does not owe you money.
        remainingAmount: Math.max(debt.totalAmount - paidAmount, 0),
      };
    })
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
}

export interface CreditorGroup {
  creditor: string;
  installments: InstallmentDebt[];
  open: OpenDebt[];
  totalRemaining: number; // everything still owed to this creditor
  dueThisMonth: number; // instalments landing on the reference month
  lastEndsOn: string | null; // 'YYYY-MM' the last commitment finishes
}

/**
 * Groups every debt by who it is owed to.
 *
 * This is what makes two card providers legible: the app has no concept of an
 * invoice, but four instalments on "Nubank" shown together under one subtotal
 * answer the same question — how much that card costs this month and in total.
 */
export function groupByCreditor(
  installments: InstallmentDebt[],
  open: OpenDebt[],
): CreditorGroup[] {
  const groups = new Map<string, CreditorGroup>();

  const ensure = (creditor: string): CreditorGroup => {
    const existing = groups.get(creditor);
    if (existing) return existing;
    const created: CreditorGroup = {
      creditor,
      installments: [],
      open: [],
      totalRemaining: 0,
      dueThisMonth: 0,
      lastEndsOn: null,
    };
    groups.set(creditor, created);
    return created;
  };

  for (const debt of installments) {
    const group = ensure(debt.creditor);
    group.installments.push(debt);
    group.totalRemaining += debt.remainingAmount;
    if (debt.currentIndex !== null) group.dueThisMonth += debt.amount;
    if (!group.lastEndsOn || debt.endsOn > group.lastEndsOn) {
      group.lastEndsOn = debt.endsOn;
    }
  }

  for (const debt of open) {
    const group = ensure(debt.debt.creditor);
    group.open.push(debt);
    group.totalRemaining += debt.remainingAmount;
  }

  // Biggest debt first: that is the one worth looking at.
  return [...groups.values()].sort(
    (a, b) => b.totalRemaining - a.totalRemaining,
  );
}

export interface DebtSummary {
  totalRemaining: number; // everything still owed, both shapes
  dueThisMonth: number; // instalments landing on the reference month
  count: number;
}

export function summarize(
  installments: InstallmentDebt[],
  open: OpenDebt[],
): DebtSummary {
  const totalRemaining =
    installments.reduce((sum, d) => sum + d.remainingAmount, 0) +
    open.reduce((sum, d) => sum + d.remainingAmount, 0);

  // Only instalments have a "this month" amount; open debts have no schedule.
  const dueThisMonth = installments
    .filter((d) => d.currentIndex !== null)
    .reduce((sum, d) => sum + d.amount, 0);

  return {
    totalRemaining,
    dueThisMonth,
    count: installments.length + open.length,
  };
}
