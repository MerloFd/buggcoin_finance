"use client";

// Derived finance metrics. Source = Entry[] (manual + bank) + Recurring[] +
// the month's RecurringRealization[]. A recurring expense is a FORECAST that
// disappears when the real expense arrives — never sum forecast + realized of
// the same recurring.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  store,
  type Direction,
  type Entry,
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

// One day of the running-balance line. `balance` carries over from prior months
// (starts from zero at first use). `projected` days are after today and use
// still-previsto recurrings.
export interface BalancePoint {
  day: number;
  balance: number;
  projected: boolean;
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
  balanceSeries: BalancePoint[];
  reload: () => void;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysIn(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function clampDay(day: number, month: string): number {
  return Math.min(day, daysIn(month));
}

// dedup: only 'merged' and 'pending' leave the totals.
function countsInTotals(e: Entry): boolean {
  return e.dedupStatus !== "merged" && e.dedupStatus !== "pending";
}

function compute(userId: string, month: string, mode: FinanceMode): FinanceData {
  const entries = store.getEntries(userId, month);
  const recurrings = store.getRecurrings(userId).filter((r) => r.active);
  const types = store.getRecurringTypes(userId);
  const typeDir = new Map<string, Direction>(
    types.map((t: RecurringType) => [t.id, t.direction]),
  );
  const dirOf = (r: Recurring): Direction => typeDir.get(r.typeId) ?? "out";

  // Lazy month closing: a previsto recurring in a past month that never matched
  // becomes 'assumed' on read (no background job — the app is client-side).
  if (mode === "open" ? false : month < currentMonth()) {
    const existing = store.getRealizations(userId, month);
    for (const r of recurrings) {
      if (!existing.some((x) => x.recurringId === r.id)) {
        store.saveRealization(userId, {
          recurringId: r.id,
          month,
          status: "assumed",
        });
      }
    }
  }

  const realizations = store.getRealizations(userId, month);
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
    day: clampDay(r.dayOfMonth, month),
    direction: dirOf(r),
    status: statusOf(r),
  }));

  // --- Running balance series ---
  const total = daysIn(month);
  const monthStart = `${month}-01`;
  const net = (e: Entry) =>
    e.direction === "in" ? Math.abs(e.amount) : -Math.abs(e.amount);
  const dayStr = (d: number) => `${month}-${String(d).padStart(2, "0")}`;

  // Balance carried in from all prior months (zero at first use).
  const carryIn = store
    .getEntries(userId)
    .filter(countsInTotals)
    .filter((e) => e.date < monthStart)
    .reduce((sum, e) => sum + net(e), 0);

  // Realized portion runs to today (open) or to the whole month (closed).
  const lastRealizedDay = mode === "open" ? (todayDay as number) : total;
  const realizedUpTo = (d: number) =>
    carryIn +
    realized
      .filter((e) => e.date <= dayStr(d))
      .reduce((sum, e) => sum + net(e), 0);
  const balanceAtToday = realizedUpTo(lastRealizedDay);

  // Projection uses still-previsto recurrings on their (clamped) day.
  const previstoRec = recurrings.filter((r) => statusOf(r) === "previsto");
  const projectedUpTo = (d: number) =>
    balanceAtToday +
    previstoRec
      .filter((r) => {
        const rd = clampDay(r.dayOfMonth, month);
        return rd > lastRealizedDay && rd <= d;
      })
      .reduce((sum, r) => sum + (dirOf(r) === "in" ? Math.abs(r.amount) : -Math.abs(r.amount)), 0);

  const balanceSeries: BalancePoint[] = [];
  for (let d = 1; d <= total; d++) {
    balanceSeries.push(
      d <= lastRealizedDay
        ? { day: d, balance: realizedUpTo(d), projected: false }
        : { day: d, balance: projectedUpTo(d), projected: true },
    );
  }

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
    balanceSeries,
    reload: () => {},
  };
}

// Lightweight realized totals for a month (list rows / mini chart).
export function monthSummary(
  userId: string,
  month: string,
): { entradas: number; gastos: number; saldo: number } {
  const realized = store.getEntries(userId, month).filter(countsInTotals);
  const gastos = realized
    .filter((e) => e.direction === "out")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const entradas = realized
    .filter((e) => e.direction === "in")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  return { entradas, gastos, saldo: entradas - gastos };
}

// Distinct months that have at least one entry, most recent first.
export function monthsWithData(userId: string): string[] {
  const months = new Set(store.getEntries(userId).map((e) => e.date.slice(0, 7)));
  return [...months].sort((a, b) => b.localeCompare(a));
}

export function useFinance(
  month: string = currentMonth(),
  mode: FinanceMode = "open",
): FinanceData | null {
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<FinanceData | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    setData(compute(userId, month, mode));
  }, [userId, month, mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;
  return { ...data, reload: load };
}
