// Domain model + store contract.
//
// Every store method takes `userId` as its first argument — the multi-user
// boundary exists from day one. Every method is async: the store is backed by
// Supabase (network), not by localStorage.

export type Direction = "in" | "out";

export interface Entry {
  id: string;
  userId: string;
  description: string;
  amount: number; // always positive
  date: string; // ISO date (transaction date, chosen by the user)
  createdAt: string; // ISO datetime — when the entry was registered (store-set)
  direction: Direction;
  category: string | null;
  source: "manual" | "bank";
  bankTransactionId?: string; // set when source === 'bank'; upsert key (idempotency)
  // dedup manual x bank:
  dedupStatus: "pending" | "merged" | "rejected" | null; // null = not a duplicate
  dedupPartnerId?: string; // the Entry it was compared against
  // recurring realization:
  realizesRecurringId?: string; // which Recurring this real expense fulfills
  paysDebtId?: string; // this expense paid down an open Debt
}

// How a recurring ends. Three shapes, mutually exclusive — the database
// enforces this with a CHECK constraint (see supabase/schema.sql).
export type RecurringEnd =
  | { kind: "never" } // rent, salary, open-ended subscription
  | { kind: "after"; occurrences: number } // installment plan: "12x"
  | { kind: "on"; date: string }; // ends on a known ISO date

export interface Recurring {
  id: string;
  userId: string;
  description: string;
  amount: number;
  typeId: string; // FK -> RecurringType. Direction comes from the type, not here.
  category: string | null;
  // Who the money is owed to ("Magalu", "Nubank"). `description` is the WHAT,
  // this is the WHO — needed to group debts by creditor.
  creditor: string | null;
  url: string | null;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = essential, 5 = cut first
  active: boolean; // paused by the user — distinct from "ended"
  frequency: "monthly" | "yearly";
  startDate: string; // ISO date. Anchor: the due day is derived from this.
  end: RecurringEnd;
}

export interface RecurringType {
  id: string;
  userId: string;
  label: string; // 'gasto' (seeded default), 'salário', 'assinatura'...
  direction: Direction; // source of truth for every Recurring of this type
  isDefault: boolean; // the seeded 'gasto' type; never deletable
}

export interface RecurringRealization {
  id: string;
  userId: string;
  recurringId: string;
  month: string; // 'YYYY-MM'
  status: "pending" | "confirmed" | "assumed";
  entryId?: string; // the real transaction that matched (pending/confirmed)
}

export interface Plan {
  id: string;
  userId: string;
  title: string;
  targetRecurringId: string; // required: every plan targets a recurring
  monthlySaving: number; // default = target Recurring.amount
  goalId: string | null; // optional: where the saved money is headed
  doneAt: string | null; // ISO date; null = not done yet
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  targetDate: string | null; // ISO date
  doneAt: string | null;
}

// A debt with no fixed installment plan ("R$ 2.000 to my brother"). NOT a
// Recurring: there is no monthly charge, so modelling it as one would invent a
// forecast expense that never happens. The outstanding balance is derived from
// the Entries that point at it, never stored.
export interface Debt {
  id: string;
  userId: string;
  creditor: string;
  description: string;
  totalAmount: number;
  dueDate: string | null; // ISO date; optional deadline
  settledAt: string | null; // ISO date; set when fully paid
}

// One connection to one financial institution (a Pluggy "item"). Meu Pluggy
// allows up to 5 on the free tier, so a user can have several.
export interface BankConnection {
  userId: string;
  itemId: string;
  institution: string | null;
}

export interface Note {
  id: string;
  userId: string;
  body: string;
  createdAt: string; // ISO date
}

// Label of the seeded, non-deletable expense type. The row is created by a
// database trigger on sign-up, so its id is a uuid we don't know upfront —
// find it by `isDefault`, never by a hardcoded id.
export const DEFAULT_RECURRING_TYPE_LABEL = "gasto";

// Input helpers: the store owns `id` and `userId`.
// `create*` takes the data without them; `save*` upserts (pass `id` to update,
// omit it to insert).
type DomainEntity = { id: string; userId: string };
export type NewData<T extends DomainEntity> = Omit<T, "id" | "userId">;
export type UpsertData<T extends DomainEntity> = Omit<T, "id" | "userId"> & {
  id?: string;
};

export interface FinanceStore {
  // Entries
  getEntries(userId: string, month?: string): Promise<Entry[]>; // month = 'YYYY-MM'
  // `createdAt` is set by the store, not the caller.
  createEntry(
    userId: string,
    data: Omit<NewData<Entry>, "createdAt">,
  ): Promise<Entry>;
  updateEntry(
    userId: string,
    id: string,
    patch: Partial<NewData<Entry>>,
  ): Promise<Entry>;
  deleteEntry(userId: string, id: string): Promise<void>;

  // Recurrings
  getRecurrings(userId: string): Promise<Recurring[]>;
  saveRecurring(userId: string, data: UpsertData<Recurring>): Promise<Recurring>;
  deleteRecurring(userId: string, id: string): Promise<void>;

  // Recurring types
  getRecurringTypes(userId: string): Promise<RecurringType[]>;
  saveRecurringType(
    userId: string,
    data: UpsertData<RecurringType>,
  ): Promise<RecurringType>;
  deleteRecurringType(userId: string, id: string): Promise<void>; // blocks default + in-use

  // Realizations
  getRealizations(
    userId: string,
    month?: string,
  ): Promise<RecurringRealization[]>;
  saveRealization(
    userId: string,
    data: UpsertData<RecurringRealization>,
  ): Promise<RecurringRealization>;
  deleteRealization(userId: string, id: string): Promise<void>;

  // Plans
  getPlans(userId: string): Promise<Plan[]>;
  savePlan(userId: string, data: UpsertData<Plan>): Promise<Plan>;
  deletePlan(userId: string, id: string): Promise<void>;

  // Goals
  getGoals(userId: string): Promise<Goal[]>;
  saveGoal(userId: string, data: UpsertData<Goal>): Promise<Goal>;
  deleteGoal(userId: string, id: string): Promise<void>;

  // Debts (open, no installment plan)
  getDebts(userId: string): Promise<Debt[]>;
  saveDebt(userId: string, data: UpsertData<Debt>): Promise<Debt>;
  deleteDebt(userId: string, id: string): Promise<void>;

  // Notes
  getNotes(userId: string): Promise<Note[]>;
  saveNote(userId: string, data: UpsertData<Note>): Promise<Note>;
  deleteNote(userId: string, id: string): Promise<void>;

  // Bank connections (Pluggy items) — several per user, one per institution.
  getConnections(userId: string): Promise<BankConnection[]>;
  saveConnection(
    userId: string,
    itemId: string,
    institution?: string | null,
  ): Promise<void>;
  removeConnection(userId: string, itemId: string): Promise<void>;
}
