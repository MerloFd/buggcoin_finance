"use client";

// "Pra quem eu devo, quanto devo, qual a parcela deste mês e em quantas vezes"
// — answered in one row per debt.
//
// This is a VIEW over data the metrics already count (an instalment is an
// expense recurring and is already inside `fixosDoMes`). Nothing here is added
// to any total.

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsync } from "@/hooks/useAsync";
import { formatBRL, formatMonthShort, parseAmount } from "@/lib/format";
import {
  groupByCreditor,
  installmentDebts,
  openDebts,
  summarize,
  type CreditorGroup,
  type InstallmentDebt,
  type OpenDebt,
} from "@/lib/debts";
import { currentMonth } from "@/hooks/useFinance";
import { store, type Direction, type Recurring } from "@/lib/store";

export function DebtSection({
  userId,
  month,
}: {
  userId: string;
  month: string;
}) {
  const [creating, setCreating] = useState(false);

  const { data, reload } = useAsync(async () => {
    const [recurrings, types, realizations, debts, entries] = await Promise.all([
      store.getRecurrings(userId),
      store.getRecurringTypes(userId),
      // Every month: the paid count spans the whole life of the debt.
      store.getRealizations(userId),
      store.getDebts(userId),
      store.getEntries(userId),
    ]);

    const typeDir = new Map<string, Direction>(
      types.map((t) => [t.id, t.direction]),
    );
    const directionOf = (r: Recurring): Direction =>
      typeDir.get(r.typeId) ?? "out";

    const installments = installmentDebts(
      recurrings,
      directionOf,
      realizations,
      month,
      currentMonth(),
    );
    const open = openDebts(debts, entries);
    return {
      summary: summarize(installments, open),
      groups: groupByCreditor(installments, open),
    };
  }, [userId, month]);

  if (!data) return null;

  const { groups, summary } = data;
  const empty = summary.count === 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Dívidas
        </h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden />
          Nova dívida
        </button>
      </div>

      {!empty && (
        <p className="text-sm">
          Devendo{" "}
          <strong className="font-mono tabular-nums">
            {formatBRL(summary.totalRemaining)}
          </strong>{" "}
          ao todo
          {summary.dueThisMonth > 0 && (
            <>
              {" · "}
              <span className="font-mono tabular-nums">
                {formatBRL(summary.dueThisMonth)}
              </span>{" "}
              este mês
            </>
          )}
        </p>
      )}

      {creating && (
        <NewDebtForm
          userId={userId}
          onDone={() => {
            setCreating(false);
            reload();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {empty && !creating && (
        <p className="text-sm text-muted-foreground">
          Nenhuma dívida registrada. Parcelamentos são criados em Adicionar,
          marcando &quot;Repetir todo mês&quot; e escolhendo Parcelado.
        </p>
      )}

      {/* Grouped by creditor: with two card providers, a flat list would make
          you add up Nubank and Inter in your head. */}
      <div className="space-y-5">
        {groups.map((group) => (
          <CreditorBlock
            key={group.creditor}
            group={group}
            userId={userId}
            onPaid={reload}
          />
        ))}
      </div>
    </section>
  );
}

function CreditorBlock({
  group,
  userId,
  onPaid,
}: {
  group: CreditorGroup;
  userId: string;
  onPaid: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1">
        <span className="min-w-0 truncate text-sm font-semibold">
          {group.creditor}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            {formatBRL(group.totalRemaining)}
          </span>
          {group.dueThisMonth > 0 && (
            <>
              {" · "}
              <span className="font-mono tabular-nums">
                {formatBRL(group.dueThisMonth)}
              </span>
              /mês
            </>
          )}
        </span>
      </div>

      {group.lastEndsOn && (
        <p className="text-xs text-muted-foreground">
          Último compromisso termina em {formatMonthShort(group.lastEndsOn)}
        </p>
      )}

      <ul className="space-y-2">
        {group.installments.map((debt) => (
          <InstallmentRow key={debt.recurring.id} debt={debt} />
        ))}
        {group.open.map((debt) => (
          <OpenRow
            key={debt.debt.id}
            debt={debt}
            userId={userId}
            onPaid={onPaid}
          />
        ))}
      </ul>
    </div>
  );
}

// Open debts are created here, not in Adicionar: they are neither an entry nor
// a recurring — there is no monthly charge to forecast.
function NewDebtForm({
  userId,
  onDone,
  onCancel,
}: {
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [creditor, setCreditor] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const amount = parseAmount(total);
    if (!creditor.trim() || !(amount > 0)) return;
    setSaving(true);
    try {
      await store.saveDebt(userId, {
        creditor: creditor.trim(),
        description: description.trim(),
        totalAmount: amount,
        dueDate: null,
        settledAt: null,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <Input
        value={creditor}
        onChange={(e) => setCreditor(e.target.value)}
        placeholder="Pra quem você deve"
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Do que se trata (opcional)"
      />
      <Input
        inputMode="decimal"
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        placeholder="Valor total"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function InstallmentRow({ debt }: { debt: InstallmentDebt }) {
  const progress = debt.total > 0 ? debt.paid / debt.total : 0;

  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{debt.description}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          vence dia {debt.dueDay}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-base font-medium tabular-nums">
          {formatBRL(debt.amount)}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          ×{debt.total}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          total{" "}
          <span className="font-mono tabular-nums">
            {formatBRL(debt.totalAmount)}
          </span>
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: "var(--primary)",
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {debt.paid} de {debt.total} pagas · faltam{" "}
        <span className="font-mono tabular-nums">
          {formatBRL(debt.remainingAmount)}
        </span>{" "}
        · acaba em {formatMonthShort(debt.endsOn)}
      </p>
    </li>
  );
}

function OpenRow({
  debt,
  userId,
  onPaid,
}: {
  debt: OpenDebt;
  userId: string;
  onPaid: () => void;
}) {
  const { totalAmount } = debt.debt;
  const progress = totalAmount > 0 ? debt.paidAmount / totalAmount : 0;
  const [payment, setPayment] = useState("");
  const [paying, setPaying] = useState(false);

  // A payment is a real expense that also points at the debt. It leaves the
  // account either way, so it counts in the month's totals like any other.
  async function registerPayment() {
    const amount = parseAmount(payment);
    if (!(amount > 0)) return;
    setPaying(true);
    try {
      await store.createEntry(userId, {
        description: `Pagamento · ${debt.debt.creditor}`,
        amount,
        date: new Date().toISOString().slice(0, 10),
        direction: "out",
        category: null,
        source: "manual",
        dedupStatus: null,
        paysDebtId: debt.debt.id,
      });
      setPayment("");
      onPaid();
    } finally {
      setPaying(false);
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">
          {debt.debt.description || "Dívida"}
          <span className="text-muted-foreground"> · {debt.debt.creditor}</span>
        </span>
        {debt.debt.dueDate && (
          <span className="shrink-0 text-xs text-muted-foreground">
            até {debt.debt.dueDate.split("-").reverse().slice(0, 2).join("/")}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-base font-medium tabular-nums">
          {formatBRL(debt.remainingAmount)}
        </span>
        <span className="text-xs text-muted-foreground">em aberto</span>
        <span className="ml-auto text-xs text-muted-foreground">
          total{" "}
          <span className="font-mono tabular-nums">
            {formatBRL(totalAmount)}
          </span>
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: "var(--primary)",
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Já pagou{" "}
        <span className="font-mono tabular-nums">
          {formatBRL(debt.paidAmount)}
        </span>{" "}
        · sem parcelas definidas
      </p>

      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          placeholder="Registrar pagamento"
          className="h-9"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={registerPayment}
          disabled={paying}
        >
          {paying ? "…" : "Pagar"}
        </Button>
      </div>
    </li>
  );
}
