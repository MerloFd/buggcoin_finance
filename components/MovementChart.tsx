"use client";

// Combo chart: bars = money movement per bucket (in up / out down), line =
// running balance on top. Answers "onde meu dinheiro foi" and "como estou de
// dinheiro" in one element. Clicking a bucket opens its transactions.

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { PeriodDetailSheet } from "@/components/PeriodDetailSheet";
import { formatBRL } from "@/lib/format";
import { buildSeries, PERIODS, type Period, type SeriesBucket } from "@/lib/series";
import type { FinanceMode } from "@/hooks/useFinance";

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type ComboType = "bar" | "line";

// Reference line at movement = 0, so bars read as up/down.
const zeroLine: Plugin<ComboType> = {
  id: "zeroLine",
  beforeDatasetsDraw(chart) {
    const scale = chart.scales.yMov;
    if (!scale) return;
    const { ctx, chartArea } = chart;
    const y = scale.getPixelForValue(0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar("--border") || "#ccc";
    ctx.stroke();
    ctx.restore();
  },
};

export function MovementChart({
  userId,
  month,
  mode,
}: {
  userId: string;
  month: string;
  mode: FinanceMode;
}) {
  const closed = mode === "closed";
  const { resolvedTheme } = useTheme();

  // A closed month has a fixed range — no period switching.
  const [period, setPeriod] = useState<Period>(closed ? "month" : "week");
  const [selected, setSelected] = useState<SeriesBucket | null>(null);

  const [colors, setColors] = useState({
    income: "#3F7A5E",
    expense: "#A84A2C",
    primary: "#4F7D63",
    forecast: "#A9B7AE",
    muted: "#6E7A72",
  });

  useEffect(() => {
    setColors({
      income: cssVar("--income") || "#3F7A5E",
      expense: cssVar("--expense") || "#A84A2C",
      primary: cssVar("--primary") || "#4F7D63",
      forecast: cssVar("--forecast") || "#A9B7AE",
      muted: cssVar("--muted-foreground") || "#6E7A72",
    });
  }, [resolvedTheme]);

  const series = useMemo(
    () =>
      buildSeries(userId, period, {
        month: closed || period === "month" ? month : undefined,
        withProjection: !closed,
      }),
    [userId, period, month, closed],
  );

  const data: ChartData<ComboType, number[], string> = {
    labels: series.map((b) => b.label),
    datasets: [
      {
        type: "bar" as const,
        label: "Entrou",
        data: series.map((b) => b.income),
        backgroundColor: colors.income,
        yAxisID: "yMov",
        borderRadius: 2,
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Saiu",
        data: series.map((b) => -b.expense),
        backgroundColor: colors.expense,
        yAxisID: "yMov",
        borderRadius: 2,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Saldo",
        data: series.map((b) => b.balance),
        borderColor: colors.primary,
        backgroundColor: colors.primary,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        yAxisID: "yBal",
        order: 1,
        // Dash only the projected stretch — the dash carries the meaning in
        // both themes, the color just reinforces it.
        segment: {
          borderDash: (ctx: { p1DataIndex: number }) =>
            series[ctx.p1DataIndex]?.projected ? [5, 4] : undefined,
          borderColor: (ctx: { p1DataIndex: number }) =>
            series[ctx.p1DataIndex]?.projected ? colors.forecast : colors.primary,
        },
      },
    ],
  };

  const options: ChartOptions<ComboType> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    onClick: (_event, elements) => {
      const index = elements[0]?.index;
      if (index !== undefined) setSelected(series[index] ?? null);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => series[items[0].dataIndex]?.title ?? "",
          label: (ctx) =>
            `${ctx.dataset.label}: ${formatBRL(Math.abs(ctx.parsed.y ?? 0))}`,
        },
      },
    },
    scales: {
      // Stacked with opposite signs = one column per bucket, income above the
      // zero line and expense below it (divergent), instead of two thin bars.
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          autoSkip: series.length > 20,
          maxRotation: 0,
          font: { size: 9 },
          color: colors.muted,
        },
      },
      // Both Y axes hidden: exact numbers come from the tooltip, so the two
      // scales can't be mistakenly compared by eye.
      yMov: { display: false, position: "left", stacked: true },
      yBal: { display: false, position: "right" },
    },
  };

  return (
    <div className="space-y-3">
      {!closed && (
        <div className="overflow-x-auto">
          <ToggleGroup
            value={[period]}
            onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}
            className="w-full"
          >
            {PERIODS.map((p) => (
              <ToggleGroupItem
                key={p.value}
                value={p.value}
                className="flex-1 whitespace-nowrap text-xs"
              >
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <div className="h-48">
        <Chart<ComboType, number[], string>
          type="bar"
          data={data}
          options={options}
          plugins={[zeroLine]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: colors.income }}
            aria-hidden
          />
          Entradas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: colors.expense }}
            aria-hidden
          />
          Saídas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t-2"
            style={{ borderColor: colors.primary }}
            aria-hidden
          />
          Saldo
        </span>
        <span className="w-full text-[11px]">
          Toque numa barra para ver os lançamentos.
        </span>
      </div>

      <PeriodDetailSheet
        userId={userId}
        bucket={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
