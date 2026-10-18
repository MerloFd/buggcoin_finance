"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Home } from "@/components/Home";
import { cn } from "@/lib/utils";
import { formatBRL, formatMonth } from "@/lib/format";
import { monthSummary, monthsWithData } from "@/hooks/useFinance";
import { useAuth } from "@/hooks/useAuth";

interface MonthRow {
  month: string;
  entradas: number;
  gastos: number;
  saldo: number;
}

export function Historico() {
  const { user } = useAuth();
  const userId = user?.id;

  const [rows, setRows] = useState<MonthRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const months = await monthsWithData(userId);
      const summaries = await Promise.all(
        months.map(async (month) => ({
          month,
          ...(await monthSummary(userId, month)),
        })),
      );
      if (!cancelled) setRows(summaries);
    })().catch((error: unknown) => {
      console.error("Historico: failed to load months", error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Up to 6, chronological (oldest -> newest) for the chart.
  const chart = useMemo(() => rows.slice(0, 6).reverse(), [rows]);
  const maxAbs = useMemo(
    () => Math.max(1, ...chart.map((r) => Math.abs(r.saldo))),
    [chart],
  );

  if (!userId) return null;

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Voltar"
            onClick={() => setSelected(null)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <h1 className="font-heading text-xl font-semibold capitalize">
            {formatMonth(selected)}
          </h1>
        </div>
        <Home month={selected} mode="closed" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-xl font-semibold">Histórico</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem histórico</p>
      ) : (
        <>
          {/* Mini bar chart: saldo per month */}
          <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-3">
            {chart.map((r) => {
              const positive = r.saldo >= 0;
              const h = Math.round((Math.abs(r.saldo) / maxAbs) * 64);
              return (
                <div
                  key={r.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${Math.max(h, 3)}px`,
                      backgroundColor: positive
                        ? "var(--income)"
                        : "var(--expense)",
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {r.month.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.month}>
                <button
                  type="button"
                  onClick={() => setSelected(r.month)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left"
                >
                  <span className="flex-1 font-medium capitalize">
                    {formatMonth(r.month)}
                  </span>
                  <span className="text-right text-xs">
                    <span className="block font-mono tabular-nums text-income">
                      +{formatBRL(r.entradas)}
                    </span>
                    <span className="block font-mono tabular-nums text-expense">
                      −{formatBRL(r.gastos)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right font-mono text-sm font-medium tabular-nums",
                      r.saldo >= 0 ? "text-income" : "text-expense",
                    )}
                  >
                    {formatBRL(r.saldo)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
