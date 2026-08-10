// Matching engine. One mechanism, two uses: dedup (bank x manual) and recurring
// realization (real expense x forecast). It NEVER merges on its own — detection
// only creates a provisional "pending" (netted) state; the user confirms or
// rejects it via the banner. Detection fires on every new Entry.
//
// Precedence: dedup runs BEFORE realization. An Entry only becomes a candidate
// to realize a recurring once it's resolved as a non-duplicate.

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

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function recurringDateISO(month: string, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

// Dedup pass: pair a new bank/manual entry with an unresolved opposite-source
// counterpart. The MANUAL side becomes 'pending' (netted); the bank copy stays.
function detectDedup(userId: string, entry: Entry): boolean {
  if (entry.dedupStatus !== null) return false;

  const others = store
    .getEntries(userId)
    .filter(
      (o) =>
        o.id !== entry.id &&
        o.dedupStatus === null &&
        o.source !== entry.source && // dedup is bank x manual only
        o.direction === entry.direction &&
        amountsClose(o.amount, entry.amount) &&
        daysApart(o.date, entry.date) <= 3,
    );

  const partner = others[0];
  if (!partner) return false;

  // Net the manual one out; keep the bank one.
  const manual = entry.source === "manual" ? entry : partner;
  const bank = entry.source === "manual" ? partner : entry;
  store.updateEntry(userId, manual.id, {
    dedupStatus: "pending",
    dedupPartnerId: bank.id,
  });
  // The current entry is involved in a dedup pair -> block realization for it.
  return true;
}

// Realization pass: pair the entry with a still-previsto recurring in its month.
function detectRealization(userId: string, entry: Entry): void {
  // Only a resolved-as-non-duplicate entry can realize a recurring.
  if (entry.dedupStatus === "pending" || entry.dedupStatus === "merged") return;

  const month = monthOf(entry.date);
  const types = store.getRecurringTypes(userId);
  const dirOf = new Map<string, Direction>(
    types.map((t: RecurringType) => [t.id, t.direction]),
  );
  const existing = store.getRealizations(userId, month);

  const candidate = store
    .getRecurrings(userId)
    .filter(
      (r: Recurring) =>
        r.active &&
        (dirOf.get(r.typeId) ?? "out") === entry.direction &&
        !existing.some((x) => x.recurringId === r.id) && // not already matched this month
        amountsClose(r.amount, entry.amount) &&
        daysApart(recurringDateISO(month, r.dayOfMonth), entry.date) <= 3,
    )[0];

  if (!candidate) return;

  store.saveRealization(userId, {
    recurringId: candidate.id,
    month,
    status: "pending",
    entryId: entry.id,
  });
}

// Run detection for a freshly created/imported entry.
export function runMatching(userId: string, entryId: string): void {
  const entry = store.getEntries(userId).find((e) => e.id === entryId);
  if (!entry) return;
  detectDedup(userId, entry);
  // Re-read: dedup may have flipped this entry to 'pending'.
  const fresh = store.getEntries(userId).find((e) => e.id === entryId);
  if (fresh) detectRealization(userId, fresh);
}
