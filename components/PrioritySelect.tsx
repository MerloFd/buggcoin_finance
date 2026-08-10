"use client";

import { cn } from "@/lib/utils";

export type Priority = 1 | 2 | 3 | 4 | 5;

// Three levels mapped onto the 1-5 model: Alta = essential (1), Baixa = cut
// first (5). Legacy values 2/4 fall back by range.
const OPTIONS: { label: string; value: Priority }[] = [
  { label: "Baixa", value: 5 },
  { label: "Média", value: 3 },
  { label: "Alta", value: 1 },
];

export function priorityLabel(p: Priority): string {
  if (p <= 2) return "Alta";
  if (p === 3) return "Média";
  return "Baixa";
}

export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  const activeLabel = priorityLabel(value);
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const active = o.label === activeLabel;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
