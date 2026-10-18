// Matching engine. One mechanism, two uses: dedup (bank x manual) and recurring
// realization (real expense x forecast). It NEVER merges on its own — detection
// only creates a provisional "pending" (netted) state; the user confirms or
// rejects it via the banner. Detection fires on every new Entry.
//
// Precedence: dedup runs BEFORE realization. An Entry only becomes a candidate
// to realize a recurring once it's resolved as a non-duplicate.

import { countsInMonth, dayOfMonthOf } from "@/lib/recurring";
import {
  store,
  type Direction,
  type Entry,
  type Recurring,
  type RecurringType,
} from "@/lib/store";

const DAY_MS = 86_400_000;

// Amounts are close when within 1 cent or 2% of the larger — whichever is bigger.
function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.01, 0.02 * Math.max(a, b));
}

function daysApart(isoA: string, isoB: string): number {
  return Math.abs(Date.parse(isoA) - Date.parse(isoB)) / DAY_MS;
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function recurringDateISO(recurring: Recurring, month: string): string {
  return `${month}-${String(dayOfMonthOf(recurring, month)).padStart(2, "0")}`;
}

// Dedup pass: pair a new bank/manual entry with an unresolved opposite-source
// counterpart. The MANUAL side becomes 'pending' (netted); the bank copy stays.
async function detectDedup(userId: string, entry: Entry): Promise<boolean> {
  if (entry.dedupStatus !== null) return false;

  const all = await store.getEntries(userId);
  const partner = all.find(
    (o) =>
      o.id !== entry.id &&
      o.dedupStatus === null &&
      o.source !== entry.source && // dedup is bank x manual only
      o.direction === entry.direction &&
      amountsClose(o.amount, entry.amount) &&
      daysApart(o.date, entry.date) <= 3,
  );
  if (!partner) return false;

  // Net the manual one out; keep the bank one.
  const manual = entry.source === "manual" ? entry : partner;
  const bank = entry.source === "manual" ? partner : entry;
  await store.updateEntry(userId, manual.id, {
    dedupStatus: "pending",
    dedupPartnerId: bank.id,
  });
  // The current entry is involved in a dedup pair -> block realization for it.
  return true;
}

// Realization pass: pair the entry with a still-previsto recurring in its month.
async function detectRealization(userId: string, entry: Entry): Promise<void> {
  // Only a resolved-as-non-duplicate entry can realize a recurring.
  if (entry.dedupStatus === "pending" || entry.dedupStatus === "merged") return;

  const month = monthOf(entry.date);
  const [types, existing, recurrings] = await Promise.all([
    store.getRecurringTypes(userId),
    store.getRealizations(userId, month),
    store.getRecurrings(userId),
  ]);
  const dirOf = new Map<string, Direction>(
    types.map((t: RecurringType) => [t.id, t.direction]),
  );

  const candidate = recurrings.filter(
    (r: Recurring) =>
      countsInMonth(r, month) &&
      (dirOf.get(r.typeId) ?? "out") === entry.direction &&
      !existing.some((x) => x.recurringId === r.id) && // not already matched this month
      amountsClose(r.amount, entry.amount) &&
      daysApart(recurringDateISO(r, month), entry.date) <= 3,
  )[0];

  if (!candidate) return;

  await store.saveRealization(userId, {
    recurringId: candidate.id,
    month,
    status: "pending",
    entryId: entry.id,
  });
}

// Run detection for a freshly created/imported entry.
export async function runMatching(
  userId: string,
  entryId: string,
): Promise<void> {
  const entries = await store.getEntries(userId);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return;
  await detectDedup(userId, entry);
  // Re-read: dedup may have flipped this entry to 'pending'.
  const refreshed = await store.getEntries(userId);
  const fresh = refreshed.find((e) => e.id === entryId);
  if (fresh) await detectRealization(userId, fresh);
}
