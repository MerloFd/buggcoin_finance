"use client";

// Derived finance metrics. Source = Entry[] (manual + bank) + Recurring[] +
// the month's RecurringRealization[]. A recurring expense is a FORECAST that
// disappears when the real expense arrives — never sum forecast + realized of
// the same recurring.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { countsInTotals } from "@/lib/entries";
import { countsInMonth, dayOfMonthOf } from "@/lib/recurring";
import { daysInMonth as daysIn } from "@/lib/series";
import {
  store,
  type Direction,
  type Recurring,
  type RecurringRealization,
  type RecurringType,
} from "@/lib/store";

export type FinanceMode = "open" | "closed";

// Status of a recurring within a month, derived from its realization.
type RecurringStatus = "previsto" | "pendente" | "realizado" | "assumido";

export interface MonthRecurring {
  id: string;
  description: string;
  day: number; // clamped to the month's last day
  direction: Direction;
  status: RecurringStatus;
}

export interface CategoryTotal {
  category: string;
  total: number;
  ratio: number; // share of total expenses
}

export interface FinanceMetrics {
  gastosRealizadosDoMes: number;
  entradasDoMes: number;
  saldoDoMes: number;
  rendaConhecida: number; // realized income + still-previsto income recurrings
  fixosDoMes: number; // all active expense recurrings (planned/committed)
  gastoVariavel: number; // unplanned real spending
  discricionario: number; // rendaConhecida - fixosDoMes (pool for unplanned)
  podeGastar: number; // discricionario - gastoVariavel (how much is left to spend)
  gastosPorCategoria: CategoryTotal[];
}

export interface FinanceData {
  month: string; // 'YYYY-MM'
  mode: FinanceMode;
  daysInMonth: number;
  todayDay: number | null; // null in closed mode
  metrics: FinanceMetrics;
  monthRecurrings: MonthRecurring[];
  reload: () => void;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function compute(
  userId: string,
  month: string,
  mode: FinanceMode,
): Promise<FinanceData> {
  const [entries, allRecurrings, types] = await Promise.all([
    store.getEntries(userId, month),
    store.getRecurrings(userId),
    store.getRecurringTypes(userId),
  ]);

  // Only recurrings that are active AND running this month (started, not
  // ended, and — when yearly — this is their month).
  const recurrings = allRecurrings.filter((r) => countsInMonth(r, month));

  const typeDir = new Map<string, Direction>(
    types.map((t: RecurringType) => [t.id, t.direction]),
  );
  const dirOf = (r: Recurring): Direction => typeDir.get(r.typeId) ?? "out";

  // Lazy month closing: a previsto recurring in a past month that never matched
  // becomes 'assumed' on read (no background job — the app is client-side).
  if (mode === "open" ? false : month < currentMonth()) {
    const existing = await store.getRealizations(userId, month);
    for (const r of recurrings) {
      if (!existing.some((x) => x.recurringId === r.id)) {
        await store.saveRealization(userId, {
          recurringId: r.id,
          month,
          status: "assumed",
        });
      }
    }
  }

  const realizations = await store.getRealizations(userId, month);
  const realizationOf = new Map<string, RecurringRealization>(
    realizations.map((x) => [x.recurringId, x]),
  );
  const statusOf = (r: Recurring): RecurringStatus => {
    const rel = realizationOf.get(r.id);
    if (!rel) return "previsto";
    if (rel.status === "pending") return "pendente";
    if (rel.status === "confirmed") return "realizado";
    return "assumido";
  };

  const realized = entries.filter(countsInTotals);

  const gastosRealizadosDoMes = realized
    .filter((e) => e.direction === "out")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const entradasDoMes = realized
    .filter((e) => e.direction === "in")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const saldoDoMes = entradasDoMes - gastosRealizadosDoMes;

  const todayDay = mode === "open" ? new Date().getDate() : null;

  // Known income: realized income + still-previsto income recurrings (salary
  // etc.) — no day filter. This replaces the old "a entrar ainda".
  const rendaPrevista =
    mode === "open"
      ? recurrings
          .filter((r) => dirOf(r) === "in" && statusOf(r) === "previsto")
          .reduce((sum, r) => sum + Math.abs(r.amount), 0)
      : 0;
  const rendaConhecida = entradasDoMes + rendaPrevista;

  // Fixed/planned expenses: every active expense recurring, committed once
  // (the money I already know is going to leave this month).
  const fixosDoMes =
    mode === "open"
      ? recurrings
          .filter((r) => dirOf(r) === "out")
          .reduce((sum, r) => sum + Math.abs(r.amount), 0)
      : 0;

  // gastoVariavel: realized out entries that don't fulfill any recurring.
  // A pending realization already moves its entry to "fixo realizado" (out of
  // gastoVariavel) even before realizesRecurringId is set on confirm.
  const fulfillingEntryIds = new Set(
    realizations
      .filter((r) => r.status === "pending" || r.status === "confirmed")
      .map((r) => r.entryId)
      .filter((id): id is string => !!id),
  );
  const gastoVariavel = realized
    .filter(
      (e) =>
        e.direction === "out" &&
        !e.realizesRecurringId &&
        !fulfillingEntryIds.has(e.id),
    )
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Discretionary pool and what's left to spend — the star metric.
  const discricionario = rendaConhecida - fixosDoMes;
  const podeGastar = discricionario - gastoVariavel;

  // gastosPorCategoria: all realized out entries grouped by category.
  const byCategory = new Map<string, number>();
  for (const e of realized.filter((x) => x.direction === "out")) {
    const key = e.category ?? "Outros";
    byCategory.set(key, (byCategory.get(key) ?? 0) + Math.abs(e.amount));
  }
  const totalOut = [...byCategory.values()].reduce((a, b) => a + b, 0);
  const gastosPorCategoria: CategoryTotal[] = [...byCategory.entries()]
    .map(([category, total]) => ({
      category,
      total,
      ratio: totalOut > 0 ? total / totalOut : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const monthRecurrings: MonthRecurring[] = recurrings.map((r) => ({
    id: r.id,
    description: r.description,
    day: dayOfMonthOf(r, month),
    direction: dirOf(r),
    status: statusOf(r),
  }));

  return {
    month,
    mode,
    daysInMonth: daysIn(month),
    todayDay,
    metrics: {
      gastosRealizadosDoMes,
      entradasDoMes,
      saldoDoMes,
      rendaConhecida,
      fixosDoMes,
      gastoVariavel,
      discricionario,
      podeGastar,
      gastosPorCategoria,
    },
    monthRecurrings,
    reload: () => {},
  };
}

// Lightweight realized totals for a month (list rows / mini chart).
export async function monthSummary(
  userId: string,
  month: string,
): Promise<{ entradas: number; gastos: number; saldo: number }> {
  const realized = (await store.getEntries(userId, month)).filter(
    countsInTotals,
  );
  const gastos = realized
    .filter((e) => e.direction === "out")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const entradas = realized
    .filter((e) => e.direction === "in")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  return { entradas, gastos, saldo: entradas - gastos };
}

// Distinct months that have at least one entry, most recent first.
export async function monthsWithData(userId: string): Promise<string[]> {
  const entries = await store.getEntries(userId);
  const months = new Set(entries.map((e) => e.date.slice(0, 7)));
  return [...months].sort((a, b) => b.localeCompare(a));
}

export function useFinance(
  month: string = currentMonth(),
  mode: FinanceMode = "open",
): FinanceData | null {
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<FinanceData | null>(null);
  // Bumped by `reload` to re-run the effect without duplicating the fetch.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!userId) return;
    // Guard against a slow response for a month the user already left.
    let cancelled = false;
    compute(userId, month, mode)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((error: unknown) => {
        console.error("useFinance: failed to load", error);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, month, mode, nonce]);

  if (!data) return null;
  return { ...data, reload };
}
