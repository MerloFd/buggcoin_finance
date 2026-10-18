"use client";

// Detail for one clicked bucket: what came in, what went out, and the
// transactions behind it.

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TxList } from "@/components/TxList";
import { useAsync } from "@/hooks/useAsync";
import { formatBRL, formatDay } from "@/lib/format";
import { listEntries } from "@/lib/entries";
import { installmentsDueBetween } from "@/lib/debts";
import { store, type Direction, type Recurring } from "@/lib/store";
import type { SeriesBucket } from "@/lib/series";

export function PeriodDetailSheet({
  userId,
  bucket,
  onClose,
}: {
  userId: string;
  bucket: SeriesBucket | null;
  onClose: () => void;
}) {
  const { data: entries } = useAsync(
    async () =>
      bucket
        ? listEntries(userId, { start: bucket.start, end: bucket.end })
        : [],
    [userId, bucket?.start, bucket?.end],
  );

  const { data: dueDebts } = useAsync(async () => {
    if (!bucket) return [];
    const [recurrings, types] = await Promise.all([
      store.getRecurrings(userId),
      store.getRecurringTypes(userId),
    ]);
    const typeDir = new Map<string, Direction>(
      types.map((t) => [t.id, t.direction]),
    );
    const directionOf = (r: Recurring): Direction =>
      typeDir.get(r.typeId) ?? "out";
    return installmentsDueBetween(
      recurrings,
      directionOf,
      bucket.start,
      bucket.end,
    );
  }, [userId, bucket?.start, bucket?.end]);

  if (!bucket) return null;
  const saldo = bucket.income - bucket.expense;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading capitalize">
            {bucket.title}
          </SheetTitle>
        </SheetHeader>

        {/* Stacked rows, not 3 columns: large amounts (R$ 100.000,00) don't fit
            a third of a phone screen. */}
        <div className="space-y-2">
          <Summary label="Entrou" value={bucket.income} tone="income" />
          <Summary label="Saiu" value={bucket.expense} tone="expense" />
          <Summary
            label="Saldo"
            value={saldo}
            tone={saldo >= 0 ? "income" : "expense"}
          />
        </div>

        {dueDebts && dueDebts.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Dívidas vencendo neste período
            </h3>
            <ul className="space-y-2">
              {dueDebts.map((debt) => (
                <li
                  key={`${debt.recurringId}-${debt.dueDate}`}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {debt.description}
                      <span className="text-muted-foreground">
                        {" "}
                        · {debt.creditor}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {formatBRL(debt.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    vence {formatDay(debt.dueDate)} · parcela {debt.index} de{" "}
                    {debt.total}
                    {debt.remainingAfter > 0 && (
                      <>
                        {" · restam "}
                        <span className="font-mono tabular-nums">
                          {formatBRL(debt.remainingAfter)}
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <TxList
          entries={entries ?? []}
          emptyText="Nenhum lançamento neste período."
        />
      </SheetContent>
    </Sheet>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className="font-mono text-sm font-medium tabular-nums"
        style={{ color: `var(--${tone})` }}
      >
        {formatBRL(value)}
      </p>
    </div>
  );
}
