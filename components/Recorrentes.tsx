"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PrioritySelect,
  priorityLabel,
  type Priority,
} from "@/components/PrioritySelect";
import { RecurringTypeSelect } from "@/components/RecurringTypeSelect";
import { formatBRL, parseAmount } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  store,
  DEFAULT_RECURRING_TYPE_ID,
  type Direction,
  type Recurring,
  type RecurringType,
} from "@/lib/store";

interface FormState {
  id?: string;
  description: string;
  amount: string;
  dayOfMonth: string;
  typeId: string;
  priority: Priority;
  url: string;
  active: boolean;
}

function emptyForm(): FormState {
  return {
    description: "",
    amount: "",
    dayOfMonth: "1",
    typeId: DEFAULT_RECURRING_TYPE_ID,
    priority: 3,
    url: "",
    active: true,
  };
}

export function Recorrentes() {
  const { user } = useAuth();
  const userId = user?.id;

  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [types, setTypes] = useState<RecurringType[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

  function reload(uid: string) {
    setRecurrings(store.getRecurrings(uid));
    setTypes(store.getRecurringTypes(uid));
  }

  useEffect(() => {
    if (userId) reload(userId);
  }, [userId]);

  const typeMap = useMemo(
    () => new Map(types.map((t) => [t.id, t])),
    [types],
  );
  const dirOf = (typeId: string): Direction =>
    typeMap.get(typeId)?.direction ?? "out";
  const typeLabel = (typeId: string): string =>
    typeMap.get(typeId)?.label ?? "—";

  if (!userId) return null;

  const sorted = [...recurrings].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.dayOfMonth - b.dayOfMonth;
  });

  function openNew() {
    setForm(emptyForm());
  }

  function openEdit(r: Recurring) {
    setForm({
      id: r.id,
      description: r.description,
      amount: String(r.amount).replace(".", ","),
      dayOfMonth: String(r.dayOfMonth),
      typeId: r.typeId,
      priority: r.priority,
      url: r.url ?? "",
      active: r.active,
    });
  }

  function toggleActive(r: Recurring) {
    store.saveRecurring(userId!, {
      id: r.id,
      description: r.description,
      amount: r.amount,
      dayOfMonth: r.dayOfMonth,
      typeId: r.typeId,
      url: r.url,
      priority: r.priority,
      active: !r.active,
    });
    reload(userId!);
  }

  function save() {
    if (!form) return;
    const amount = parseAmount(form.amount);
    const day = Number.parseInt(form.dayOfMonth, 10);
    if (!form.description.trim() || !(amount > 0) || !(day >= 1 && day <= 31)) {
      return; // invalid; keep the form open
    }
    store.saveRecurring(userId!, {
      id: form.id,
      description: form.description.trim(),
      amount,
      dayOfMonth: day,
      typeId: form.typeId,
      url: form.url.trim() || null,
      priority: form.priority,
      active: form.active,
    });
    reload(userId!);
    setForm(null);
  }

  function remove() {
    if (!form?.id) return;
    store.deleteRecurring(userId!, form.id);
    reload(userId!);
    setForm(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Recorrentes</h1>
        {!form && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            Novo
          </Button>
        )}
      </div>

      {form ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Field label="Descrição">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Aluguel, Netflix..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Dia do mês">
              <Input
                inputMode="numeric"
                value={form.dayOfMonth}
                onChange={(e) =>
                  setForm({ ...form, dayOfMonth: e.target.value })
                }
                placeholder="1"
              />
            </Field>
          </div>

          <Field label="Tipo">
            <RecurringTypeSelect
              userId={userId}
              value={form.typeId}
              onChange={(typeId) => setForm({ ...form, typeId })}
              types={types}
              onTypesChange={() => reload(userId)}
            />
          </Field>

          <Field label="Prioridade">
            <PrioritySelect
              value={form.priority}
              onChange={(p) => setForm({ ...form, priority: p })}
            />
          </Field>

          <Field label="Link (opcional)">
            <Input
              inputMode="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button onClick={save}>Salvar</Button>
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
            {form.id && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Excluir"
                onClick={remove}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum recorrente ainda. Toque em Novo para criar.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => {
            const income = dirOf(r.typeId) === "in";
            return (
              <li key={r.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
                    !r.active && "text-muted-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums">
                      {r.dayOfMonth}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {r.description}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {typeLabel(r.typeId)} · {priorityLabel(r.priority)}
                        {!r.active && " · inativo"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-right font-mono text-sm tabular-nums",
                        r.active && (income ? "text-income" : "text-expense"),
                      )}
                    >
                      {formatBRL(r.amount)}
                    </span>
                  </button>

                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir link"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}

                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.active}
                    aria-label={r.active ? "Desativar" : "Ativar"}
                    onClick={() => toggleActive(r)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      r.active ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-card transition-all",
                        r.active ? "left-[18px]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
