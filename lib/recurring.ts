// Derived facts about a Recurring.
//
// The due day, whether it runs in a given month, and "parcela 3 de 12" are all
// computed from `startDate` / `frequency` / `end`. Nothing here is stored, so
// nothing here can drift out of sync with the record.

import { clampDay } from "@/lib/series";
import type { Recurring } from "@/lib/store/types";

// Months between two 'YYYY-MM' values (negative when `to` precedes `from`).
function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function stepOf(recurring: Recurring): number {
  return recurring.frequency === "yearly" ? 12 : 1;
}

// The day this recurring falls on within `month`, clamped to the month's last
// day — a day-31 recurring lands on the 28th in February. Same clamp the month
// ruler uses, so the dot never falls off the bar.
export function dayOfMonthOf(recurring: Recurring, month: string): number {
  const day = Number(recurring.startDate.slice(8, 10));
  return clampDay(day, month);
}

// Does this recurring produce an occurrence in `month`? Answers three
// questions at once: has it started, has it ended, and — when yearly — is this
// its month.
export function occursInMonth(recurring: Recurring, month: string): boolean {
  const startMonth = recurring.startDate.slice(0, 7);
  if (month < startMonth) return false;

  const elapsed = monthsBetween(startMonth, month);
  const step = stepOf(recurring);
  if (elapsed % step !== 0) return false;

  const end = recurring.end;
  if (end.kind === "after") {
    const occurrenceNumber = elapsed / step + 1;
    if (occurrenceNumber > end.occurrences) return false;
  }
  if (end.kind === "on" && month > end.date.slice(0, 7)) return false;

  return true;
}

// Active (not paused by the user) AND running this month. Metrics and the
// month ruler both filter on this — "paused" and "ended" are different states
// but neither should show up as a forecast.
export function countsInMonth(recurring: Recurring, month: string): boolean {
  return recurring.active && occursInMonth(recurring, month);
}

// "Parcela 3 de 12" — only meaningful for recurrings that end after N
// occurrences. Returns null for open-ended ones.
export function installmentOf(
  recurring: Recurring,
  month: string,
): { current: number; total: number } | null {
  if (recurring.end.kind !== "after") return null;
  const elapsed = monthsBetween(recurring.startDate.slice(0, 7), month);
  return {
    current: Math.floor(elapsed / stepOf(recurring)) + 1,
    total: recurring.end.occurrences,
  };
}

// Has this recurring finished for good (as of `month`)? Used to grey out the
// row instead of making it vanish.
export function hasEnded(recurring: Recurring, month: string): boolean {
  const end = recurring.end;
  if (end.kind === "never") return false;
  if (end.kind === "on") return month > end.date.slice(0, 7);

  const elapsed = monthsBetween(recurring.startDate.slice(0, 7), month);
  return elapsed / stepOf(recurring) + 1 > end.occurrences;
}
