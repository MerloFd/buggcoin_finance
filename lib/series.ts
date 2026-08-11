// Chart series: money movement (in/out) per bucket plus the running balance.
// Pure functions — no React. Spans multiple months, which is why this lives
// outside useFinance (that hook is intentionally month-scoped).

import { countsInTotals, netAmount } from "@/lib/entries";
import { store, type Direction, type Recurring } from "@/lib/store";

export type Period = "week" | "month" | "semester" | "year";

export type Granularity = "day" | "week" | "month";

export interface SeriesBucket {
  key: string; // "2026-08-10" | "2026-W-2026-08-05" | "2026-08"
  label: string; // axis label
  title: string; // human title for the detail sheet
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
  income: number;
  expense: number; // positive number
  balance: number; // running balance at the end of the bucket
  projected: boolean; // bucket lies entirely in the future
}

export const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "semester", label: "Semestre" },
  { value: "year", label: "Ano" },
];

// --- date helpers (local time, ISO 'YYYY-MM-DD') ---

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function clampDay(day: number, month: string): number {
  return Math.min(day, daysInMonth(month));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

// --- bucket skeletons ---

type Skeleton = Omit<
  SeriesBucket,
  "income" | "expense" | "balance" | "projected"
>;

function dayBuckets(startISO: string, endISO: string): Skeleton[] {
  const out: Skeleton[] = [];
  for (let d = fromISO(startISO); iso(d) <= endISO; d = addDays(d, 1)) {
    const key = iso(d);
    out.push({ key, label: dayLabel(key), title: dayLabel(key), start: key, end: key });
  }
  return out;
}

function weekBuckets(startISO: string, endISO: string): Skeleton[] {
  const out: Skeleton[] = [];
  for (let d = fromISO(startISO); iso(d) <= endISO; d = addDays(d, 7)) {
    const start = iso(d);
    const rawEnd = iso(addDays(d, 6));
    const end = rawEnd > endISO ? endISO : rawEnd;
    out.push({
      key: `W-${start}`,
      label: dayLabel(start),
      title: `${dayLabel(start)} – ${dayLabel(end)}`,
      start,
      end,
    });
  }
  return out;
}

function monthBuckets(startISO: string, endISO: string): Skeleton[] {
  const out: Skeleton[] = [];
  const last = monthKey(fromISO(endISO));
  let cursor = fromISO(startISO);
  cursor.setDate(1);
  while (monthKey(cursor) <= last) {
    const key = monthKey(cursor);
    const start = `${key}-01`;
    const rawEnd = `${key}-${String(daysInMonth(key)).padStart(2, "0")}`;
    out.push({
      key,
      label: monthLabel(key),
      title: monthTitle(key),
      start: start < startISO ? startISO : start,
      end: rawEnd > endISO ? endISO : rawEnd,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

// Range + granularity for a period. All windows end today, except `month`,
// which is the full calendar month (the only period with future buckets).
function planFor(
  period: Period,
  anchorMonth?: string,
): { start: string; end: string; granularity: Granularity } {
  const today = new Date();

  if (period === "month") {
    const month = anchorMonth ?? monthKey(today);
    return {
      start: `${month}-01`,
      end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
      granularity: "day",
    };
  }

  const end = iso(today);
  if (period === "week") {
    return { start: iso(addDays(today, -6)), end, granularity: "day" };
  }
  if (period === "semester") {
    const from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { start: iso(from), end, granularity: "week" };
  }
  // year
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  return { start: iso(from), end, granularity: "month" };
}

/**
 * Build the chart series for a period.
 *
 * @param userId  the owner
 * @param period  which window/granularity
 * @param opts.month  anchor month ('YYYY-MM') — used by period 'month'
 * @param opts.withProjection  apply still-previsto recurrings to future buckets
 */
export function buildSeries(
  userId: string,
  period: Period,
  opts: { month?: string; withProjection?: boolean } = {},
): SeriesBucket[] {
  const { month, withProjection = true } = opts;
  const { start, end, granularity } = planFor(period, month);

  const skeletons =
    granularity === "day"
      ? dayBuckets(start, end)
      : granularity === "week"
        ? weekBuckets(start, end)
        : monthBuckets(start, end);

  const entries = store.getEntries(userId).filter(countsInTotals);

  // Balance carried in from everything before the window (zero at first use).
  const carryIn = entries
    .filter((e) => e.date < start)
    .reduce((sum, e) => sum + netAmount(e), 0);

  const todayISO = iso(new Date());

  // Forecast movement per day, from recurrings still 'previsto' this month.
  const forecast = withProjection
    ? forecastByDay(userId, month ?? monthKey(new Date()), todayISO)
    : new Map<string, number>();

  let running = carryIn;
  return skeletons.map((s) => {
    const inBucket = entries.filter((e) => e.date >= s.start && e.date <= s.end);
    const income = inBucket
      .filter((e) => e.direction === "in")
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const expense = inBucket
      .filter((e) => e.direction === "out")
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const projected = s.start > todayISO;

    // Realized movement always counts; forecast only fills future buckets.
    let delta = income - expense;
    if (projected) {
      for (const [day, value] of forecast) {
        if (day >= s.start && day <= s.end) delta += value;
      }
    }
    running += delta;

    return { ...s, income, expense, balance: running, projected };
  });
}

// Net forecast per ISO day for recurrings that are still 'previsto' in `month`
// and fall after today.
function forecastByDay(
  userId: string,
  month: string,
  todayISO: string,
): Map<string, number> {
  const types = store.getRecurringTypes(userId);
  const dirOf = new Map<string, Direction>(
    types.map((t) => [t.id, t.direction]),
  );
  const realized = new Set(
    store.getRealizations(userId, month).map((r) => r.recurringId),
  );

  const out = new Map<string, number>();
  for (const r of store.getRecurrings(userId) as Recurring[]) {
    if (!r.active || realized.has(r.id)) continue;
    const day = String(clampDay(r.dayOfMonth, month)).padStart(2, "0");
    const dateISO = `${month}-${day}`;
    if (dateISO <= todayISO) continue;
    const value =
      (dirOf.get(r.typeId) ?? "out") === "in"
        ? Math.abs(r.amount)
        : -Math.abs(r.amount);
    out.set(dateISO, (out.get(dateISO) ?? 0) + value);
  }
  return out;
}
