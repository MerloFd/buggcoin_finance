"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PrioritySelect, type Priority } from "@/components/PrioritySelect";
import { RecurringTypeSelect } from "@/components/RecurringTypeSelect";
import { cn } from "@/lib/utils";
import { parseAmount } from "@/lib/format";
import { runMatching } from "@/lib/matching";
import { KNOWN_CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";
import {
  store,
  DEFAULT_RECURRING_TYPE_ID,
  type Direction,
  type RecurringType,
} from "@/lib/store";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AddEntry() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();

  const [direction, setDirection] = useState<Direction>("out");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("");

  // Recurring path (checkbox "Repetir todo mês").
  const [repeat, setRepeat] = useState(false);
  const [typeId, setTypeId] = useState(DEFAULT_RECURRING_TYPE_ID);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [priority, setPriority] = useState<Priority>(3);
  const [url, setUrl] = useState("");

  const [types, setTypes] = useState<RecurringType[]>([]);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);

  function reloadTypes() {
    if (userId) setTypes(store.getRecurringTypes(userId));
  }

  useEffect(() => {
    if (!userId) return;
    setTypes(store.getRecurringTypes(userId));
    const used = store
      .getEntries(userId)
      .map((e) => e.category)
      .filter((c): c is string => !!c);
    setUsedCategories([...new Set(used)]);
  }, [userId]);

  const categoryOptions = useMemo(
    () => [...new Set([...KNOWN_CATEGORIES, ...usedCategories])],
    [usedCategories],
  );

  if (!userId) return null;

  function close() {
    router.push("/");
  }

  function save() {
    const value = parseAmount(amount);
    if (!description.trim() || !(value > 0)) return;

    if (repeat) {
      // The checkbox transforms the form into Recurring creation. Direction
      // comes from the type; category is not part of a Recurring.
      const day = Number.parseInt(dayOfMonth, 10);
      if (!(day >= 1 && day <= 31)) return;
      store.saveRecurring(userId!, {
        description: description.trim(),
        amount: value,
        dayOfMonth: day,
        typeId,
        url: url.trim() || null,
        priority,
        active: true,
      });
    } else {
      const entry = store.createEntry(userId!, {
        description: description.trim(),
        amount: value,
        date,
        direction,
        category: category.trim() || null,
        source: "manual",
        dedupStatus: null,
      });
      // Detection fires on every new Entry (spec: Regra de matching).
      runMatching(userId!, entry.id);
    }
    router.push("/");
  }

  const accent = direction === "in" ? "text-income" : "text-expense";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Adicionar</h1>
        <Button
          variant="outline"
          size="icon"
          aria-label="Fechar"
          onClick={close}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Direction toggle — hidden in recurring mode (direction comes from type). */}
      {!repeat && (
        <div className="grid grid-cols-2 gap-2">
          <DirectionButton
            active={direction === "in"}
            direction="in"
            onClick={() => setDirection("in")}
          />
          <DirectionButton
            active={direction === "out"}
            direction="out"
            onClick={() => setDirection("out")}
          />
        </div>
      )}

      <Field label="Valor">
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className={cn("font-mono tabular-nums", accent)}
        />
      </Field>

      <Field label="Descrição">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mercado, salário..."
        />
      </Field>

      {!repeat && (
        <>
          <Field label="Data">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Categoria">
            <Input
              list="category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Alimentação, Transporte..."
            />
            <datalist id="category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      <label className="flex items-center gap-2 py-1">
        <Checkbox
          checked={repeat}
          onCheckedChange={(v) => setRepeat(v === true)}
        />
        <span className="text-sm">Repetir todo mês</span>
      </label>

      {repeat && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Field label="Tipo">
            <RecurringTypeSelect
              userId={userId}
              value={typeId}
              onChange={setTypeId}
              types={types}
              onTypesChange={reloadTypes}
            />
          </Field>

          <Field label="Dia do mês">
            <Input
              inputMode="numeric"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="1"
            />
          </Field>

          <Field label="Prioridade">
            <PrioritySelect value={priority} onChange={setPriority} />
          </Field>

          <Field label="Link (opcional)">
            <Input
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
      )}

      <Button className="w-full" onClick={save}>
        Salvar
      </Button>
    </div>
  );
}

function DirectionButton({
  active,
  direction,
  onClick,
}: {
  active: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  const isIn = direction === "in";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border py-2 text-sm font-medium transition-colors",
        active
          ? isIn
            ? "border-income bg-income/10 text-income"
            : "border-expense bg-expense/10 text-expense"
          : "border-border text-muted-foreground",
      )}
    >
      {isIn ? "Entrada" : "Saída"}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
