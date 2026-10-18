// Money helpers. Stored amounts are always positive numbers.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

// ISO datetime -> "09/08 14:32".
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 'YYYY-MM-DD' -> "09/08". Parsed as a local date, never through `new Date(iso)`,
// which reads a bare ISO date as UTC and can shift it a day backwards.
export function formatDay(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

// 'YYYY-MM' -> "jul/2026". Compact form for inline use inside a row.
export function formatMonthShort(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Date(year, monthNumber - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  return `${label}/${year}`;
}

// 'YYYY-MM' -> "julho de 2026".
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

// Parse a user-typed amount into a number. Returns NaN when unparseable.
// If a comma is present, treat it as pt-BR (dots = thousands, comma = decimal:
// "1.234,56"). Otherwise parse directly so "50.5" stays a dot-decimal.
export function parseAmount(input: string): number {
  const trimmed = input.trim().replace(/\s/g, "");
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  return Number.parseFloat(normalized);
}
