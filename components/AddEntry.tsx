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
import { formatBRL, parseAmount } from "@/lib/format";
import { runMatching } from "@/lib/matching";
import { KNOWN_CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";
import { currentMonth } from "@/hooks/useFinance";
import { store, type Direction, type RecurringType } from "@/lib/store";

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
  // Empty until the types load: the default type's id is a uuid created by the
  // database, so it can't be known upfront.
  const [typeId, setTypeId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [priority, setPriority] = useState<Priority>(3);
  const [url, setUrl] = useState("");
  // Installment path: "12x de R$ 350" is a recurring that ends after N times.
  const [duration, setDuration] = useState<"forever" | "installments">(
    "forever",
  );
  const [occurrences, setOccurrences] = useState("12");
  const [creditor, setCreditor] = useState("");

  const [types, setTypes] = useState<RecurringType[]>([]);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [usedCreditors, setUsedCreditors] = useState<string[]>([]);

  async function reloadTypes() {
    if (!userId) return;
    setTypes(await store.getRecurringTypes(userId));
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [nextTypes, entries, recurrings] = await Promise.all([
        store.getRecurringTypes(userId),
        store.getEntries(userId),
        store.getRecurrings(userId),
      ]);
      if (cancelled) return;
      setTypes(nextTypes);
      setUsedCreditors([
        ...new Set(
          recurrings
            .map((r) => r.creditor)
            .filter((c): c is string => !!c),
        ),
      ]);
      setTypeId(
        (current) =>
          current ||
          nextTypes.find((t) => t.isDefault)?.id ||
          nextTypes[0]?.id ||
          "",
      );
      const used = entries
        .map((e) => e.category)
        .filter((c): c is string => !!c);
      setUsedCategories([...new Set(used)]);
    })().catch((error: unknown) => {
      console.error("AddEntry: failed to load", error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const categoryOptions = useMemo(
    () => [...new Set([...KNOWN_CATEGORIES, ...usedCategories])],
    [usedCategories],
  );
  const creditorOptions = usedCreditors;

  // "12x de R$ 350 = R$ 4.200" — shown for confirmation while typing.
  const installmentTotal = useMemo(() => {
    const value = parseAmount(amount);
    const times = Number.parseInt(occurrences, 10);
    if (!(value > 0) || !(times > 0)) return null;
    return value * times;
  }, [amount, occurrences]);

  if (!userId) return null;

  function close() {
    router.push("/");
  }

  async function save() {
    const value = parseAmount(amount);
    if (!description.trim() || !(value > 0)) return;

    if (repeat) {
      // The checkbox transforms the form into Recurring creation. Direction
      // comes from the type.
      const day = Number.parseInt(dayOfMonth, 10);
      if (!(day >= 1 && day <= 31) || !typeId) return;

      const times = Number.parseInt(occurrences, 10);
      const isInstallment = duration === "installments";
      if (isInstallment && !(times > 0)) return;

      await store.saveRecurring(userId!, {
        description: description.trim(),
        amount: value,
        typeId,
        category: category.trim() || null,
        creditor: isInstallment ? creditor.trim() || null : null,
        url: url.trim() || null,
        priority,
        active: true,
        frequency: "monthly",
        startDate: `${currentMonth()}-${String(day).padStart(2, "0")}`,
        end: isInstallment
          ? { kind: "after", occurrences: times }
          : { kind: "never" },
      });
    } else {
      const entry = await store.createEntry(userId!, {
        description: description.trim(),
        amount: value,
        date,
        direction,
        category: category.trim() || null,
        source: "manual",
        dedupStatus: null,
      });
      // Detection fires on every new Entry (spec: Regra de matching).
      await runMatching(userId!, entry.id);
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

          <Field label="Por quanto tempo">
            <div className="flex gap-2">
              <DurationButton
                active={duration === "forever"}
                onClick={() => setDuration("forever")}
              >
                Sempre
              </DurationButton>
              <DurationButton
                active={duration === "installments"}
                onClick={() => setDuration("installments")}
              >
                Parcelado
              </DurationButton>
            </div>
          </Field>

          {duration === "installments" && (
            <>
              <Field label="Quantas parcelas">
                <Input
                  inputMode="numeric"
                  value={occurrences}
                  onChange={(e) => setOccurrences(e.target.value)}
                  placeholder="12"
                />
                {installmentTotal !== null && (
                  <p className="text-xs text-muted-foreground">
                    {occurrences}× de {formatBRL(parseAmount(amount))} ={" "}
                    <span className="font-mono tabular-nums">
                      {formatBRL(installmentTotal)}
                    </span>{" "}
                    no total
                  </p>
                )}
              </Field>

              <Field label="Credor">
                <Input
                  list="creditor-options"
                  value={creditor}
                  onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Magalu, Nubank..."
                />
                <datalist id="creditor-options">
                  {creditorOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </>
          )}

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

function DurationButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 flex-1 rounded-md border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
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
