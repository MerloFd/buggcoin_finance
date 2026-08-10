// LocalStorage implementation of FinanceStore.
// Keys are namespaced per user: `finance:{userId}:{collection}`.
// TODO: replace with SupabaseStore.

import {
  DEFAULT_RECURRING_TYPE_ID,
  DEFAULT_RECURRING_TYPE_LABEL,
  type Entry,
  type FinanceStore,
  type NewData,
  type Note,
  type Plan,
  type Recurring,
  type RecurringRealization,
  type RecurringType,
  type UpsertData,
} from "./types";

type Collection =
  | "entries"
  | "recurrings"
  | "recurringTypes"
  | "realizations"
  | "plans"
  | "notes"
  | "connection";

function key(userId: string, collection: Collection): string {
  return `finance:${userId}:${collection}`;
}

function newId(): string {
  return crypto.randomUUID();
}

function read<T>(userId: string, collection: Collection): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key(userId, collection));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T>(userId: string, collection: Collection, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(userId, collection), JSON.stringify(value));
}

// Upsert by id: replace when the id already exists, otherwise append.
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((it) => it.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export class LocalStorageStore implements FinanceStore {
  // --- Entries ---

  getEntries(userId: string, month?: string): Entry[] {
    const entries = read<Entry>(userId, "entries");
    if (!month) return entries;
    return entries.filter((e) => e.date.startsWith(month));
  }

  createEntry(userId: string, data: Omit<NewData<Entry>, "createdAt">): Entry {
    const entry: Entry = {
      ...data,
      id: newId(),
      userId,
      createdAt: new Date().toISOString(),
    };
    write(userId, "entries", [...read<Entry>(userId, "entries"), entry]);
    return entry;
  }

  updateEntry(userId: string, id: string, patch: Partial<NewData<Entry>>): Entry {
    const entries = read<Entry>(userId, "entries");
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error(`Entry ${id} not found`);
    const updated: Entry = { ...entries[index], ...patch, id, userId };
    const next = [...entries];
    next[index] = updated;
    write(userId, "entries", next);
    return updated;
  }

  deleteEntry(userId: string, id: string): void {
    write(
      userId,
      "entries",
      read<Entry>(userId, "entries").filter((e) => e.id !== id),
    );
  }

  // --- Recurrings ---

  getRecurrings(userId: string): Recurring[] {
    return read<Recurring>(userId, "recurrings");
  }

  saveRecurring(userId: string, data: UpsertData<Recurring>): Recurring {
    const recurring: Recurring = { ...data, id: data.id ?? newId(), userId };
    write(
      userId,
      "recurrings",
      upsert(read<Recurring>(userId, "recurrings"), recurring),
    );
    return recurring;
  }

  deleteRecurring(userId: string, id: string): void {
    write(
      userId,
      "recurrings",
      read<Recurring>(userId, "recurrings").filter((r) => r.id !== id),
    );
    // Integrity: plans targeting a removed recurring must not dangle.
    write(
      userId,
      "plans",
      read<Plan>(userId, "plans").filter((p) => p.targetRecurringId !== id),
    );
  }

  // --- Recurring types ---

  getRecurringTypes(userId: string): RecurringType[] {
    const types = read<RecurringType>(userId, "recurringTypes");
    if (types.some((t) => t.id === DEFAULT_RECURRING_TYPE_ID)) return types;
    // Seed the non-deletable default expense type on first read.
    const withDefault: RecurringType = {
      id: DEFAULT_RECURRING_TYPE_ID,
      userId,
      label: DEFAULT_RECURRING_TYPE_LABEL,
      direction: "out",
    };
    const seeded = [withDefault, ...types];
    write(userId, "recurringTypes", seeded);
    return seeded;
  }

  saveRecurringType(userId: string, data: UpsertData<RecurringType>): RecurringType {
    const type: RecurringType = { ...data, id: data.id ?? newId(), userId };
    write(
      userId,
      "recurringTypes",
      upsert(this.getRecurringTypes(userId), type),
    );
    return type;
  }

  deleteRecurringType(userId: string, id: string): void {
    if (id === DEFAULT_RECURRING_TYPE_ID) {
      throw new Error("The default 'gasto' type cannot be deleted");
    }
    const inUse = read<Recurring>(userId, "recurrings").some(
      (r) => r.typeId === id,
    );
    if (inUse) {
      throw new Error("This type is still used by a recurring and cannot be deleted");
    }
    write(
      userId,
      "recurringTypes",
      this.getRecurringTypes(userId).filter((t) => t.id !== id),
    );
  }

  // --- Realizations ---

  getRealizations(userId: string, month?: string): RecurringRealization[] {
    const all = read<RecurringRealization>(userId, "realizations");
    if (!month) return all;
    return all.filter((r) => r.month === month);
  }

  saveRealization(
    userId: string,
    data: UpsertData<RecurringRealization>,
  ): RecurringRealization {
    const realization: RecurringRealization = {
      ...data,
      id: data.id ?? newId(),
      userId,
    };
    write(
      userId,
      "realizations",
      upsert(read<RecurringRealization>(userId, "realizations"), realization),
    );
    return realization;
  }

  deleteRealization(userId: string, id: string): void {
    write(
      userId,
      "realizations",
      read<RecurringRealization>(userId, "realizations").filter(
        (r) => r.id !== id,
      ),
    );
  }

  // --- Plans ---

  getPlans(userId: string): Plan[] {
    return read<Plan>(userId, "plans");
  }

  savePlan(userId: string, data: UpsertData<Plan>): Plan {
    const plan: Plan = { ...data, id: data.id ?? newId(), userId };
    write(userId, "plans", upsert(read<Plan>(userId, "plans"), plan));
    return plan;
  }

  deletePlan(userId: string, id: string): void {
    write(
      userId,
      "plans",
      read<Plan>(userId, "plans").filter((p) => p.id !== id),
    );
  }

  // --- Notes ---

  getNotes(userId: string): Note[] {
    return read<Note>(userId, "notes").sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  saveNote(userId: string, data: UpsertData<Note>): Note {
    const note: Note = { ...data, id: data.id ?? newId(), userId };
    write(userId, "notes", upsert(read<Note>(userId, "notes"), note));
    return note;
  }

  deleteNote(userId: string, id: string): void {
    write(
      userId,
      "notes",
      read<Note>(userId, "notes").filter((n) => n.id !== id),
    );
  }

  // --- Bank connection ---

  getConnection(userId: string): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key(userId, "connection"));
  }

  saveConnection(userId: string, itemId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key(userId, "connection"), itemId);
  }

  removeConnection(userId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key(userId, "connection"));
  }
}
