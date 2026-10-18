"use client";

// Inline, persistent banner (never a toast) for unresolved matches. Nothing is
// merged automatically — the user confirms or rejects each pending pair here.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { runMatching } from "@/lib/matching";
import { useAuth } from "@/hooks/useAuth";
import {
  store,
  type Entry,
  type Recurring,
  type RecurringRealization,
} from "@/lib/store";

interface DedupItem {
  entry: Entry; // the netted (pending) manual entry
}

interface RealizationItem {
  realization: RecurringRealization;
  recurring: Recurring;
  entry: Entry;
}

export function PendingMatchesBanner() {
  const { user } = useAuth();
  const userId = user?.id;
  const pathname = usePathname();

  const [dedup, setDedup] = useState<DedupItem[]>([]);
  const [realizations, setRealizations] = useState<RealizationItem[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const [entries, recurrings, allRealizations] = await Promise.all([
      store.getEntries(userId),
      store.getRecurrings(userId),
      store.getRealizations(userId),
    ]);

    setDedup(
      entries
        .filter((e) => e.dedupStatus === "pending")
        .map((entry) => ({ entry })),
    );

    setRealizations(
      allRealizations
        .filter((r) => r.status === "pending")
        .flatMap((realization) => {
          const recurring = recurrings.find(
            (r) => r.id === realization.recurringId,
          );
          const entry = entries.find((e) => e.id === realization.entryId);
          if (!recurring || !entry) return [];
          return [{ realization, recurring, entry }];
        }),
    );
  }, [userId]);

  // Reload on mount and whenever the route changes (e.g. back from Adicionar).
  useEffect(() => {
    load().catch((error: unknown) => {
      console.error("PendingMatchesBanner: failed to load", error);
    });
  }, [load, pathname]);

  if (!userId) return null;
  if (dedup.length === 0 && realizations.length === 0) return null;

  // --- Dedup actions ---
  async function confirmDedup(entry: Entry) {
    await store.updateEntry(userId!, entry.id, { dedupStatus: "merged" });
    await load();
  }
  async function rejectDedup(entry: Entry) {
    await store.updateEntry(userId!, entry.id, { dedupStatus: "rejected" });
    // A rejected entry may now realize a recurring — retry detection.
    await runMatching(userId!, entry.id);
    await load();
  }

  // --- Realization actions ---
  async function confirmRealization(item: RealizationItem) {
    await store.saveRealization(userId!, {
      id: item.realization.id,
      recurringId: item.recurring.id,
      month: item.realization.month,
      status: "confirmed",
      entryId: item.entry.id,
    });
    await store.updateEntry(userId!, item.entry.id, {
      realizesRecurringId: item.recurring.id,
    });
    await load();
  }
  async function rejectRealization(item: RealizationItem) {
    await store.deleteRealization(userId!, item.realization.id);
    await load();
  }

  return (
    <div className="space-y-2 border-b border-amber/40 bg-amber/10 px-4 py-3">
      {dedup.map(({ entry }) => (
        <div key={entry.id} className="space-y-1.5">
          <p className="text-sm font-medium">
            Dois lançamentos parecem duplicados
          </p>
          <p className="text-xs text-muted-foreground">
            {entry.description} · {formatBRL(entry.amount)}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => confirmDedup(entry)}>
              É duplicata
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectDedup(entry)}
            >
              Manter os dois
            </Button>
          </div>
        </div>
      ))}

      {realizations.map((item) => (
        <div key={item.realization.id} className="space-y-1.5">
          <p className="text-sm font-medium">
            {item.recurring.description} previsto casou com este lançamento?
          </p>
          <p className="text-xs text-muted-foreground">
            {item.entry.description} · {formatBRL(item.entry.amount)}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => confirmRealization(item)}>
              Sim, casar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectRealization(item)}
            >
              Não
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
