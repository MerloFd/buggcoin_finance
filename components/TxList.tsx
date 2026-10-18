"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatDay } from "@/lib/format";
import { getCategoryStyle } from "@/lib/categories";
import type { Entry } from "@/lib/store";

// Presentational: callers filter/sort with `listEntries` from lib/entries.
export function TxList({
  entries,
  emptyText = "Nenhum lançamento neste mês.",
}: {
  entries: Entry[];
  emptyText?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const income = e.direction === "in";
        const cat = getCategoryStyle(e.category);
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                income ? "text-income" : "text-expense",
              )}
              style={{
                backgroundColor: income
                  ? "color-mix(in srgb, var(--income) 14%, transparent)"
                  : "color-mix(in srgb, var(--expense) 14%, transparent)",
              }}
            >
              {income ? (
                <ArrowDownLeft className="size-4" aria-hidden />
              ) : (
                <ArrowUpRight className="size-4" aria-hidden />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{e.description}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden
                />
                <span className="truncate">
                  {e.category ?? "Sem categoria"} · {formatDay(e.date)}
                </span>
              </span>
            </span>

            <span
              className={cn(
                "shrink-0 font-mono text-sm font-medium tabular-nums",
                income ? "text-income" : "text-expense",
              )}
            >
              {income ? "+" : "−"}
              {formatBRL(e.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
