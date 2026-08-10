"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { formatBRL } from "@/lib/format";
import { getCategoryStyle } from "@/lib/categories";
import type { CategoryTotal } from "@/hooks/useFinance";

ChartJS.register(ArcElement, Tooltip);

export function CategoryChart({ items }: { items: CategoryTotal[] }) {
  const { resolvedTheme } = useTheme();
  // Segment gaps use the card color so slices read as separated in both themes.
  const [borderColor, setBorderColor] = useState("#ffffff");

  useEffect(() => {
    const card = getComputedStyle(document.documentElement)
      .getPropertyValue("--card")
      .trim();
    if (card) setBorderColor(card);
  }, [resolvedTheme]);

  const total = items.reduce((sum, i) => sum + i.total, 0);
  const colors = useMemo(
    () => items.map((i) => getCategoryStyle(i.category).color),
    [items],
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem gastos neste mês ainda.
      </p>
    );
  }

  const data = {
    labels: items.map((i) => i.category),
    datasets: [
      {
        data: items.map((i) => i.total),
        backgroundColor: colors,
        borderColor,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    cutout: "68%",
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: number }) => ` ${formatBRL(ctx.parsed)}`,
        },
      },
    },
  } as const;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <Doughnut data={data} options={options} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Total
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatBRL(total)}
          </span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
        {items.map((i) => (
          <li key={i.category} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: getCategoryStyle(i.category).color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{i.category}</span>
            <span className="text-muted-foreground">
              {Math.round(i.ratio * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
