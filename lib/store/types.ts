// Domain model + store contract.
// Every store method takes `userId` as its first argument — the multi-user
// boundary exists from day one even though auth is mocked.

export type Direction = "in" | "out";

export interface Entry {
  id: string;
  userId: string;
  description: string;
  amount: number; // always positive
  date: string; // ISO date (transaction date, chosen by the user)
  createdAt: string; // ISO datetime — when the entry was registered (store-set)
  direction: Direction;
  category: string | null;
  source: "manual" | "bank";
  bankTransactionId?: string; // set when source === 'bank'; upsert key (idempotency)
  // dedup manual x bank:
  dedupStatus: "pending" | "merged" | "rejected" | null; // null = not a duplicate
  dedupPartnerId?: string; // the Entry it was compared against
  // recurring realization:
  realizesRecurringId?: string; // which Recurring this real expense fulfills
}

export interface Recurring {
  id: string;
  userId: string;
  description: string;
  amount: number;
  dayOfMonth: number; // 1-31; clamps to the last day when it overflows the month
  typeId: string; // FK -> RecurringType. Direction comes from the type, not here.
  url: string | null;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = essential, 5 = cut first
  active: boolean;
}

export interface RecurringType {
  id: string;
  userId: string;
  label: string; // 'gasto' (default, not deletable), 'salário', 'assinatura'...
  direction: Direction; // source of truth for the direction of every Recurring of this type
}

export interface RecurringRealization {
  id: string;
  userId: string;
  recurringId: string;
  month: string; // 'YYYY-MM'
  status: "pending" | "confirmed" | "assumed";
  entryId?: string; // the real transaction that matched (pending/confirmed)
}

export interface Plan {
  id: string;
  userId: string;
  title: string;
  targetRecurringId: string; // required: every plan targets a recurring
  monthlySaving: number; // default = target Recurring.amount
  done: boolean;
}

export interface Note {
  id: string;
  userId: string;
  body: string;
  createdAt: string; // ISO date
}

// Fixed id + label of the non-deletable default expense type.
export const DEFAULT_RECURRING_TYPE_ID = "default-gasto";
export const DEFAULT_RECURRING_TYPE_LABEL = "gasto";

// Input helpers: the store owns `id` and `userId`.
// `create*` takes the data without them; `save*` upserts (pass `id` to update,
// omit it to insert).
type DomainEntity = { id: string; userId: string };
export type NewData<T extends DomainEntity> = Omit<T, "id" | "userId">;
export type UpsertData<T extends DomainEntity> = Omit<T, "id" | "userId"> & {
  id?: string;
};

export interface FinanceStore {
  // Entries
  getEntries(userId: string, month?: string): Entry[]; // month = 'YYYY-MM'
  // `createdAt` is set by the store, not the caller.
  createEntry(userId: string, data: Omit<NewData<Entry>, "createdAt">): Entry;
  updateEntry(userId: string, id: string, patch: Partial<NewData<Entry>>): Entry;
  deleteEntry(userId: string, id: string): void;

  // Recurrings
  getRecurrings(userId: string): Recurring[];
  saveRecurring(userId: string, data: UpsertData<Recurring>): Recurring;
  deleteRecurring(userId: string, id: string): void;

  // Recurring types
  getRecurringTypes(userId: string): RecurringType[];
  saveRecurringType(userId: string, data: UpsertData<RecurringType>): RecurringType;
  deleteRecurringType(userId: string, id: string): void; // blocks default + in-use

  // Realizations
  getRealizations(userId: string, month?: string): RecurringRealization[];
  saveRealization(
    userId: string,
    data: UpsertData<RecurringRealization>,
  ): RecurringRealization;
  deleteRealization(userId: string, id: string): void;

  // Plans
  getPlans(userId: string): Plan[];
  savePlan(userId: string, data: UpsertData<Plan>): Plan;
  deletePlan(userId: string, id: string): void;

  // Notes
  getNotes(userId: string): Note[];
  saveNote(userId: string, data: UpsertData<Note>): Note;
  deleteNote(userId: string, id: string): void;

  // Bank connection (Pluggy itemId)
  getConnection(userId: string): string | null;
  saveConnection(userId: string, itemId: string): void;
  removeConnection(userId: string): void;
}
