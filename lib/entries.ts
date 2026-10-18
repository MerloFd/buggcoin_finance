// Shared Entry domain rules. Single source of truth for "does this entry count"
// and "what is its signed value", used by the metrics hook, the chart series and
// the transaction lists.

import { store, type Entry } from "@/lib/store";

// Dedup: only 'merged' and 'pending' leave the totals ('pending' is netted while
// it waits for the user; 'rejected' and null are real money).
export function countsInTotals(e: Entry): boolean {
  return e.dedupStatus !== "merged" && e.dedupStatus !== "pending";
}

// Signed value: income adds, expense subtracts. Never trust the stored sign.
export function netAmount(e: Entry): number {
  return e.direction === "in" ? Math.abs(e.amount) : -Math.abs(e.amount);
}

// Entries inside an inclusive ISO date range, newest first.
export async function listEntries(
  userId: string,
  { start, end, limit }: { start: string; end: string; limit?: number },
): Promise<Entry[]> {
  const all = await store.getEntries(userId);
  const list = all
    .filter(countsInTotals)
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
  return limit ? list.slice(0, limit) : list;
}
