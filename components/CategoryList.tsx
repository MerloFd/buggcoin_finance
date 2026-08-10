import { formatBRL } from "@/lib/format";
import { getCategoryStyle } from "@/lib/categories";
import type { CategoryTotal } from "@/hooks/useFinance";

export function CategoryList({ items }: { items: CategoryTotal[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem gastos neste mês ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map(({ category, total, ratio }) => {
        const { icon: Icon, color } = getCategoryStyle(category);
        return (
          <li key={category} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
              <span className="flex-1 truncate">{category}</span>
              <span className="font-mono text-sm tabular-nums">
                {formatBRL(total)}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground">
                {Math.round(ratio * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(ratio * 100, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
