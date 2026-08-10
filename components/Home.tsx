"use client";

import type { ReactNode } from "react";
import { useFinance, currentMonth, type FinanceMode } from "@/hooks/useFinance";
import { useCountUp } from "@/hooks/useCountUp";
import { formatBRL } from "@/lib/format";
import { BalanceChart } from "@/components/BalanceChart";
import { StatCard } from "@/components/StatCard";
import { CategorySection } from "@/components/CategorySection";
import { TxList } from "@/components/TxList";
import { useAuth } from "@/hooks/useAuth";
import type { FinanceMetrics } from "@/hooks/useFinance";

// Reused by Histórico in `closed` mode: a past month has no "today", so the
// projection and the "posso gastar" framing are hidden — the hero shows the
// month's saldo and only realized data remains.
export function Home({
  month = currentMonth(),
  mode = "open",
}: {
  month?: string;
  mode?: FinanceMode;
}) {
  const { user } = useAuth();
  const data = useFinance(month, mode);
  const closed = mode === "closed";

  const heroTarget = data
    ? closed
      ? data.metrics.saldoDoMes
      : data.metrics.podeGastar
    : 0;
  const hero = useCountUp(heroTarget);

  if (!data || !user) return null;
  const { metrics, balanceSeries } = data;
  const saldoPositive = metrics.saldoDoMes >= 0;
  const heroPositive = heroTarget >= 0;

  return (
    <div className="space-y-16">
      {/* 1 — Visão geral do mês */}
      <Section title="Visão geral do mês">
        <div className="rounded-lg border border-border bg-secondary px-4 py-5">
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {closed ? "Saldo do mês" : "Posso gastar este mês"}
          </p>
          <p
            className="font-heading text-4xl font-bold tabular-nums"
            style={{ color: heroPositive ? undefined : "var(--expense)" }}
          >
            {formatBRL(hero)}
          </p>
        </div>
        <BalanceChart series={balanceSeries} />
      </Section>

      {/* 2 — Métricas */}
      <Section title="Métricas">
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {closed ? (
            <>
              <StatCard
                label="Entradas do mês"
                value={metrics.entradasDoMes}
                tone="income"
              />
              <StatCard
                label="Gastos do mês"
                value={metrics.gastosRealizadosDoMes}
                tone="expense"
              />
            </>
          ) : (
            <>
              <StatCard
                label="Renda do mês"
                value={metrics.rendaConhecida}
                tone="income"
              />
              <StatCard
                label="Gastos Planejados"
                value={metrics.fixosDoMes}
                tone="expense"
              />
              <StatCard
                label="Gasto variável"
                value={metrics.gastoVariavel}
                tone="expense"
              />
              <StatCard
                label="Saldo do mês"
                value={metrics.saldoDoMes}
                tone={saldoPositive ? "income" : "expense"}
              />
            </>
          )}
        </div>

        {!closed && <BudgetBar metrics={metrics} />}

        <CategorySection items={metrics.gastosPorCategoria} />
      </Section>

      {/* 3 — Recentes */}
      <Section title="Recentes">
        <TxList userId={user.id} month={month} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// How much of the discretionary pool (income - fixed) is already spent on
// unplanned expenses, and how much is left to spend.
function BudgetBar({ metrics }: { metrics: FinanceMetrics }) {
  const { discricionario, gastoVariavel, podeGastar } = metrics;

  if (discricionario <= 0) {
    return (
      <div className="space-y-1.5">
        <div
          className="h-2 rounded-full"
          style={{ backgroundColor: "var(--expense)" }}
        />
        <p className="text-sm text-muted-foreground">
          Seus fixos já passam do que você recebe este mês
        </p>
      </div>
    );
  }

  const progress = gastoVariavel / discricionario;
  const pct = Math.min(progress * 100, 100);
  const color =
    progress < 0.8
      ? "var(--income)"
      : progress <= 1
        ? "var(--amber)"
        : "var(--expense)";

  const text =
    progress <= 1
      ? `Gastou ${formatBRL(gastoVariavel)} de ${formatBRL(discricionario)} · pode gastar mais ${formatBRL(podeGastar)}`
      : `Passou ${formatBRL(Math.abs(podeGastar))} do que podia gastar`;

  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
