"use client";

import { useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryList } from "@/components/CategoryList";
import { CategoryChart } from "@/components/CategoryChart";
import type { CategoryTotal } from "@/hooks/useFinance";

type View = "bars" | "donut";

// View choice is ephemeral device UI state (resets on reload) — not domain data.
export function CategorySection({ items }: { items: CategoryTotal[] }) {
  const [view, setView] = useState<View>("donut");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Gastos por categoria
        </h2>
        <div className="flex gap-1">
          <ViewButton
            active={view === "bars"}
            label="Barras"
            onClick={() => setView("bars")}
          >
            <BarChart3 className="size-4" aria-hidden />
          </ViewButton>
          <ViewButton
            active={view === "donut"}
            label="Donut"
            onClick={() => setView("donut")}
          >
            <PieChart className="size-4" aria-hidden />
          </ViewButton>
        </div>
      </div>

      {view === "bars" ? (
        <CategoryList items={items} />
      ) : (
        <CategoryChart items={items} />
      )}
    </section>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
