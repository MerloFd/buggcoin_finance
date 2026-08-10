"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatBRL } from "@/lib/format";
import type { BalancePoint } from "@/hooks/useFinance";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Horizontal reference line at balance = 0.
const zeroLine: Plugin<"line"> = {
  id: "zeroLine",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const y = scales.y.getPixelForValue(0);
    if (y < chartArea.top || y > chartArea.bottom) return;
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

export function BalanceChart({ series }: { series: BalancePoint[] }) {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState({
    primary: "#4F7D63",
    forecast: "#A9B7AE",
    muted: "#6E7A72",
    income: "#3F7A5E",
    expense: "#A84A2C",
  });

  useEffect(() => {
    setColors({
      primary: cssVar("--primary") || "#4F7D63",
      forecast: cssVar("--forecast") || "#A9B7AE",
      muted: cssVar("--muted-foreground") || "#6E7A72",
      income: cssVar("--income") || "#3F7A5E",
      expense: cssVar("--expense") || "#A84A2C",
    });
  }, [resolvedTheme]);

  if (series.length === 0) return null;

  const lastIndex = series.length - 1;
  const endPositive = series[lastIndex].balance >= 0;
  const endColor = endPositive ? colors.income : colors.expense;

  const labels = series.map((p) => String(p.day));
  const realized = series.map((p) => (p.projected ? null : p.balance));
  // Projection includes the last realized point so the two lines connect.
  const projected = series.map((p, i) =>
    p.projected || (i < lastIndex && series[i + 1].projected) ? p.balance : null,
  );

  const pointRadius = (ctx: { dataIndex: number }) =>
    ctx.dataIndex === lastIndex ? 4 : 0;

  const data = {
    labels,
    datasets: [
      {
        label: "Realizado",
        data: realized,
        borderColor: colors.primary,
        backgroundColor: colors.primary + "1A",
        borderWidth: 2.5,
        fill: "origin" as const,
        tension: 0,
        pointRadius,
        pointHoverRadius: 5,
        pointBackgroundColor: endColor,
        pointBorderColor: endColor,
      },
      {
        label: "Projeção",
        data: projected,
        borderColor: colors.forecast,
        borderWidth: 2,
        borderDash: [5, 4],
        fill: false,
        tension: 0,
        pointRadius,
        pointHoverRadius: 5,
        pointBackgroundColor: endColor,
        pointBorderColor: endColor,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (item) => item.parsed.y !== null,
        callbacks: {
          title: (items) => `Dia ${items[0].label}`,
          label: (ctx) => formatBRL(ctx.parsed.y as number),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: false, // every day, as requested
          maxRotation: 0,
          font: { size: 8 },
          color: colors.muted,
        },
      },
      y: { display: false, grid: { display: false } },
    },
  };

  return (
    <div className="h-44">
      <Line data={data} options={options} plugins={[zeroLine]} />
    </div>
  );
}
