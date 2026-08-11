"use client";

// Detail for one clicked bucket: what came in, what went out, and the
// transactions behind it.

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TxList } from "@/components/TxList";
import { formatBRL } from "@/lib/format";
import { listEntries } from "@/lib/entries";
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
  const entries = useMemo(
    () =>
      bucket
        ? listEntries(userId, { start: bucket.start, end: bucket.end })
        : [],
    [userId, bucket],
  );

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

        <TxList
          entries={entries}
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
