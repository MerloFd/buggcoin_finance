// Supabase implementation of FinanceStore.
//
// Rows are snake_case in Postgres and camelCase in the domain, so every table
// gets an explicit row interface plus a mapper. No `any`, and no leaking the
// database shape past this file.
//
// RLS already restricts every query to the signed-in user, but each query also
// filters by `user_id` explicitly: the contract says the caller passes the id,
// and relying on two independent guards is cheap.

import { supabase } from "@/lib/supabase/client";
import type {
  BankConnection,
  Debt,
  Direction,
  Entry,
  FinanceStore,
  Goal,
  NewData,
  Note,
  Plan,
  Recurring,
  RecurringEnd,
  RecurringRealization,
  RecurringType,
  UpsertData,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Result<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data");
  return result.data;
}

function expectNoError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

// Postgres `numeric` can reach the client as a string depending on the driver
// path; coerce so callers always get a real number.
function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

// Half-open range [start, nextStart) for a 'YYYY-MM' month — avoids having to
// know how many days the month has.
function monthRange(month: string): { start: string; nextStart: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    start: `${month}-01`,
    nextStart: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface EntryRow {
  id: string;
  user_id: string;
  description: string;
  amount: number | string;
  date: string;
  created_at: string;
  direction: Direction;
  category: string | null;
  source: "manual" | "bank";
  bank_transaction_id: string | null;
  dedup_status: "pending" | "merged" | "rejected" | null;
  dedup_partner_id: string | null;
  realizes_recurring_id: string | null;
  pays_debt_id: string | null;
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    amount: num(row.amount),
    date: row.date,
    createdAt: row.created_at,
    direction: row.direction,
    category: row.category,
    source: row.source,
    bankTransactionId: optional(row.bank_transaction_id),
    dedupStatus: row.dedup_status,
    dedupPartnerId: optional(row.dedup_partner_id),
    realizesRecurringId: optional(row.realizes_recurring_id),
    paysDebtId: optional(row.pays_debt_id),
  };
}

function fromEntry(
  userId: string,
  data: Partial<Omit<NewData<Entry>, "createdAt">>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  if (data.description !== undefined) row.description = data.description;
  if (data.amount !== undefined) row.amount = data.amount;
  if (data.date !== undefined) row.date = data.date;
  if (data.direction !== undefined) row.direction = data.direction;
  if (data.category !== undefined) row.category = data.category;
  if (data.source !== undefined) row.source = data.source;
  if (data.bankTransactionId !== undefined)
    row.bank_transaction_id = data.bankTransactionId;
  if (data.dedupStatus !== undefined) row.dedup_status = data.dedupStatus;
  if (data.dedupPartnerId !== undefined)
    row.dedup_partner_id = data.dedupPartnerId;
  if (data.realizesRecurringId !== undefined)
    row.realizes_recurring_id = data.realizesRecurringId;
  if (data.paysDebtId !== undefined) row.pays_debt_id = data.paysDebtId;
  return row;
}

interface RecurringRow {
  id: string;
  user_id: string;
  description: string;
  amount: number | string;
  type_id: string;
  category: string | null;
  creditor: string | null;
  url: string | null;
  priority: number;
  active: boolean;
  frequency: "monthly" | "yearly";
  start_date: string;
  end_kind: "never" | "after" | "on";
  end_occurrences: number | null;
  end_date: string | null;
}

function toRecurringEnd(row: RecurringRow): RecurringEnd {
  switch (row.end_kind) {
    case "after":
      return { kind: "after", occurrences: row.end_occurrences ?? 1 };
    case "on":
      return { kind: "on", date: row.end_date ?? row.start_date };
    default:
      return { kind: "never" };
  }
}

function toRecurring(row: RecurringRow): Recurring {
  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    amount: num(row.amount),
    typeId: row.type_id,
    category: row.category,
    creditor: row.creditor,
    url: row.url,
    priority: row.priority as Recurring["priority"],
    active: row.active,
    frequency: row.frequency,
    startDate: row.start_date,
    end: toRecurringEnd(row),
  };
}

function fromRecurring(
  userId: string,
  data: UpsertData<Recurring>,
): Record<string, unknown> {
  // Only the column matching the end kind is filled — the others must be null
  // or the database CHECK rejects the row.
  const end = data.end;
  return {
    user_id: userId,
    description: data.description,
    amount: data.amount,
    type_id: data.typeId,
    category: data.category,
    creditor: data.creditor,
    url: data.url,
    priority: data.priority,
    active: data.active,
    frequency: data.frequency,
    start_date: data.startDate,
    end_kind: end.kind,
    end_occurrences: end.kind === "after" ? end.occurrences : null,
    end_date: end.kind === "on" ? end.date : null,
  };
}

interface RecurringTypeRow {
  id: string;
  user_id: string;
  label: string;
  direction: Direction;
  is_default: boolean;
}

function toRecurringType(row: RecurringTypeRow): RecurringType {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    direction: row.direction,
    isDefault: row.is_default,
  };
}

interface RealizationRow {
  id: string;
  user_id: string;
  recurring_id: string;
  month: string;
  status: "pending" | "confirmed" | "assumed";
  entry_id: string | null;
}

function toRealization(row: RealizationRow): RecurringRealization {
  return {
    id: row.id,
    userId: row.user_id,
    recurringId: row.recurring_id,
    month: row.month,
    status: row.status,
    entryId: optional(row.entry_id),
  };
}

interface PlanRow {
  id: string;
  user_id: string;
  title: string;
  target_recurring_id: string;
  monthly_saving: number | string;
  goal_id: string | null;
  done_at: string | null;
}

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    targetRecurringId: row.target_recurring_id,
    monthlySaving: num(row.monthly_saving),
    goalId: row.goal_id,
    doneAt: row.done_at,
  };
}

interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  target_amount: number | string;
  target_date: string | null;
  done_at: string | null;
}

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    targetAmount: num(row.target_amount),
    targetDate: row.target_date,
    doneAt: row.done_at,
  };
}

interface DebtRow {
  id: string;
  user_id: string;
  creditor: string;
  description: string;
  total_amount: number | string;
  due_date: string | null;
  settled_at: string | null;
}

function toDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    creditor: row.creditor,
    description: row.description,
    totalAmount: num(row.total_amount),
    dueDate: row.due_date,
    settledAt: row.settled_at,
  };
}

interface BankConnectionRow {
  user_id: string;
  item_id: string;
  institution: string | null;
}

interface NoteRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class SupabaseStore implements FinanceStore {
  // --- Entries ---

  async getEntries(userId: string, month?: string): Promise<Entry[]> {
    let query = supabase
      .from("entries")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (month) {
      const { start, nextStart } = monthRange(month);
      query = query.gte("date", start).lt("date", nextStart);
    }

    const rows = unwrap<EntryRow[]>(await query);
    return rows.map(toEntry);
  }

  async createEntry(
    userId: string,
    data: Omit<NewData<Entry>, "createdAt">,
  ): Promise<Entry> {
    const row = unwrap<EntryRow>(
      await supabase
        .from("entries")
        .insert(fromEntry(userId, data))
        .select()
        .single(),
    );
    return toEntry(row);
  }

  async updateEntry(
    userId: string,
    id: string,
    patch: Partial<NewData<Entry>>,
  ): Promise<Entry> {
    const { user_id: _ignored, ...changes } = fromEntry(userId, patch);
    const row = unwrap<EntryRow>(
      await supabase
        .from("entries")
        .update(changes)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single(),
    );
    return toEntry(row);
  }

  async deleteEntry(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase.from("entries").delete().eq("id", id).eq("user_id", userId),
    );
  }

  // --- Recurrings ---

  async getRecurrings(userId: string): Promise<Recurring[]> {
    const rows = unwrap<RecurringRow[]>(
      await supabase
        .from("recurrings")
        .select("*")
        .eq("user_id", userId)
        .order("start_date", { ascending: true }),
    );
    return rows.map(toRecurring);
  }

  async saveRecurring(
    userId: string,
    data: UpsertData<Recurring>,
  ): Promise<Recurring> {
    const payload = fromRecurring(userId, data);
    const row = data.id
      ? unwrap<RecurringRow>(
          await supabase
            .from("recurrings")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<RecurringRow>(
          await supabase.from("recurrings").insert(payload).select().single(),
        );
    return toRecurring(row);
  }

  async deleteRecurring(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase
        .from("recurrings")
        .delete()
        .eq("id", id)
        .eq("user_id", userId),
    );
  }

  // --- Recurring types ---

  async getRecurringTypes(userId: string): Promise<RecurringType[]> {
    const rows = unwrap<RecurringTypeRow[]>(
      await supabase
        .from("recurring_types")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("label", { ascending: true }),
    );
    return rows.map(toRecurringType);
  }

  async saveRecurringType(
    userId: string,
    data: UpsertData<RecurringType>,
  ): Promise<RecurringType> {
    const payload = {
      user_id: userId,
      label: data.label,
      direction: data.direction,
      is_default: data.isDefault,
    };
    const row = data.id
      ? unwrap<RecurringTypeRow>(
          await supabase
            .from("recurring_types")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<RecurringTypeRow>(
          await supabase
            .from("recurring_types")
            .insert(payload)
            .select()
            .single(),
        );
    return toRecurringType(row);
  }

  async deleteRecurringType(userId: string, id: string): Promise<void> {
    const existing = unwrap<RecurringTypeRow>(
      await supabase
        .from("recurring_types")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single(),
    );
    if (existing.is_default) {
      throw new Error("O tipo padrão não pode ser excluído.");
    }

    const result = await supabase
      .from("recurring_types")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    // The FK is ON DELETE RESTRICT, so the database refuses while a recurring
    // still uses this type. Translate the Postgres code into a readable message.
    if (result.error) {
      if (result.error.code === "23503") {
        throw new Error(
          "Este tipo ainda está em uso por um recorrente e não pode ser excluído.",
        );
      }
      throw new Error(result.error.message);
    }
  }

  // --- Realizations ---

  async getRealizations(
    userId: string,
    month?: string,
  ): Promise<RecurringRealization[]> {
    let query = supabase
      .from("recurring_realizations")
      .select("*")
      .eq("user_id", userId);
    if (month) query = query.eq("month", month);

    const rows = unwrap<RealizationRow[]>(await query);
    return rows.map(toRealization);
  }

  async saveRealization(
    userId: string,
    data: UpsertData<RecurringRealization>,
  ): Promise<RecurringRealization> {
    const payload = {
      user_id: userId,
      recurring_id: data.recurringId,
      month: data.month,
      status: data.status,
      entry_id: data.entryId ?? null,
    };
    // One realization per (recurring, month) — upserting on that pair keeps a
    // re-run from creating a second row.
    const row = unwrap<RealizationRow>(
      await supabase
        .from("recurring_realizations")
        .upsert(payload, { onConflict: "recurring_id,month" })
        .select()
        .single(),
    );
    return toRealization(row);
  }

  async deleteRealization(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase
        .from("recurring_realizations")
        .delete()
        .eq("id", id)
        .eq("user_id", userId),
    );
  }

  // --- Plans ---

  async getPlans(userId: string): Promise<Plan[]> {
    const rows = unwrap<PlanRow[]>(
      await supabase.from("plans").select("*").eq("user_id", userId),
    );
    return rows.map(toPlan);
  }

  async savePlan(userId: string, data: UpsertData<Plan>): Promise<Plan> {
    const payload = {
      user_id: userId,
      title: data.title,
      target_recurring_id: data.targetRecurringId,
      monthly_saving: data.monthlySaving,
      goal_id: data.goalId,
      done_at: data.doneAt,
    };
    const row = data.id
      ? unwrap<PlanRow>(
          await supabase
            .from("plans")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<PlanRow>(
          await supabase.from("plans").insert(payload).select().single(),
        );
    return toPlan(row);
  }

  async deletePlan(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase.from("plans").delete().eq("id", id).eq("user_id", userId),
    );
  }

  // --- Goals ---

  async getGoals(userId: string): Promise<Goal[]> {
    const rows = unwrap<GoalRow[]>(
      await supabase.from("goals").select("*").eq("user_id", userId),
    );
    return rows.map(toGoal);
  }

  async saveGoal(userId: string, data: UpsertData<Goal>): Promise<Goal> {
    const payload = {
      user_id: userId,
      title: data.title,
      target_amount: data.targetAmount,
      target_date: data.targetDate,
      done_at: data.doneAt,
    };
    const row = data.id
      ? unwrap<GoalRow>(
          await supabase
            .from("goals")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<GoalRow>(
          await supabase.from("goals").insert(payload).select().single(),
        );
    return toGoal(row);
  }

  async deleteGoal(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase.from("goals").delete().eq("id", id).eq("user_id", userId),
    );
  }

  // --- Notes ---

  async getNotes(userId: string): Promise<Note[]> {
    const rows = unwrap<NoteRow[]>(
      await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toNote);
  }

  async saveNote(userId: string, data: UpsertData<Note>): Promise<Note> {
    const payload = { user_id: userId, body: data.body };
    const row = data.id
      ? unwrap<NoteRow>(
          await supabase
            .from("notes")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<NoteRow>(
          await supabase.from("notes").insert(payload).select().single(),
        );
    return toNote(row);
  }

  async deleteNote(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase.from("notes").delete().eq("id", id).eq("user_id", userId),
    );
  }

  // --- Debts ---

  async getDebts(userId: string): Promise<Debt[]> {
    const rows = unwrap<DebtRow[]>(
      await supabase
        .from("debts")
        .select("*")
        .eq("user_id", userId)
        .order("creditor", { ascending: true }),
    );
    return rows.map(toDebt);
  }

  async saveDebt(userId: string, data: UpsertData<Debt>): Promise<Debt> {
    const payload = {
      user_id: userId,
      creditor: data.creditor,
      description: data.description,
      total_amount: data.totalAmount,
      due_date: data.dueDate,
      settled_at: data.settledAt,
    };
    const row = data.id
      ? unwrap<DebtRow>(
          await supabase
            .from("debts")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single(),
        )
      : unwrap<DebtRow>(
          await supabase.from("debts").insert(payload).select().single(),
        );
    return toDebt(row);
  }

  async deleteDebt(userId: string, id: string): Promise<void> {
    expectNoError(
      await supabase.from("debts").delete().eq("id", id).eq("user_id", userId),
    );
  }

  // --- Bank connections ---

  async getConnections(userId: string): Promise<BankConnection[]> {
    const rows = unwrap<BankConnectionRow[]>(
      await supabase
        .from("bank_connections")
        .select("user_id, item_id, institution")
        .eq("user_id", userId),
    );
    return rows.map((row) => ({
      userId: row.user_id,
      itemId: row.item_id,
      institution: row.institution,
    }));
  }

  async saveConnection(
    userId: string,
    itemId: string,
    institution: string | null = null,
  ): Promise<void> {
    expectNoError(
      await supabase.from("bank_connections").upsert(
        { user_id: userId, item_id: itemId, institution },
        // Composite key: one row per (user, institution connection).
        { onConflict: "user_id,item_id" },
      ),
    );
  }

  async removeConnection(userId: string, itemId: string): Promise<void> {
    expectNoError(
      await supabase
        .from("bank_connections")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId),
    );
  }
}
