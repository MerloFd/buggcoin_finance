import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-lg font-medium tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {formatBRL(value)}
      </p>
    </div>
  );
}
