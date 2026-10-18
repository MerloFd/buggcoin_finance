// One-time import of the data the app used to keep in localStorage.
//
// The old store namespaced keys as `finance:{userId}:{collection}` with a
// mocked userId ('local-user'). Postgres generates new uuids on insert, so
// every cross-reference (dedup partner, realized recurring, plan target) has
// to be rewritten through an old-id -> new-id map as we go.
//
// This is the sanctioned exception to "no direct localStorage": we are reading
// the old storage precisely in order to leave it behind.

import { store } from "./index";
import type { Direction, Entry, Note, Plan, Recurring } from "./types";

// --- legacy shapes (the model as it was before the Supabase migration) ---

interface LegacyRecurringType {
  id: string;
  label: string;
  direction: Direction;
}

interface LegacyRecurring {
  id: string;
  description: string;
  amount: number;
  dayOfMonth: number;
  typeId: string;
  url: string | null;
  priority: 1 | 2 | 3 | 4 | 5;
  active: boolean;
}

interface LegacyEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  direction: Direction;
  category: string | null;
  source: "manual" | "bank";
  bankTransactionId?: string;
  dedupStatus: "pending" | "merged" | "rejected" | null;
  dedupPartnerId?: string;
  realizesRecurringId?: string;
}

interface LegacyRealization {
  id: string;
  recurringId: string;
  month: string;
  status: "pending" | "confirmed" | "assumed";
  entryId?: string;
}

interface LegacyPlan {
  id: string;
  title: string;
  targetRecurringId: string;
  monthlySaving: number;
  done: boolean;
}

interface LegacyNote {
  id: string;
  body: string;
  createdAt: string;
}

const LEGACY_DEFAULT_TYPE_ID = "default-gasto";

function read<T>(legacyUserId: string, collection: string): T[] {
  try {
    const raw = window.localStorage.getItem(
      `finance:${legacyUserId}:${collection}`,
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// Finds the userId the old mocked session used. Scans instead of assuming
// 'local-user' so a renamed session still imports.
function findLegacyUserId(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    const match = key?.match(/^finance:(.+):(entries|recurrings)$/);
    if (match) return match[1];
  }
  return null;
}

export interface LegacySummary {
  legacyUserId: string;
  entries: number;
  recurrings: number;
  notes: number;
}

// What is sitting in localStorage waiting to be imported, if anything.
export function inspectLegacyData(): LegacySummary | null {
  const legacyUserId = findLegacyUserId();
  if (!legacyUserId) return null;

  const summary: LegacySummary = {
    legacyUserId,
    entries: read<LegacyEntry>(legacyUserId, "entries").length,
    recurrings: read<LegacyRecurring>(legacyUserId, "recurrings").length,
    notes: read<LegacyNote>(legacyUserId, "notes").length,
  };
  const total = summary.entries + summary.recurrings + summary.notes;
  return total > 0 ? summary : null;
}

// The old Recurring had no startDate. Anchor it before the earliest entry so
// it still occurs in every month that has history.
function anchorMonth(entries: LegacyEntry[]): string {
  const months = entries.map((e) => e.date.slice(0, 7)).sort();
  if (months.length > 0) return months[0];
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface ImportResult {
  recurringTypes: number;
  recurrings: number;
  entries: number;
  realizations: number;
  plans: number;
  notes: number;
}

// Imports everything under the signed-in user. Safe to think of as one-way:
// localStorage is left untouched, so a failed run can simply be retried.
export async function importLegacyData(
  userId: string,
  legacyUserId: string,
): Promise<ImportResult> {
  const legacyTypes = read<LegacyRecurringType>(
    legacyUserId,
    "recurringTypes",
  );
  const legacyRecurrings = read<LegacyRecurring>(legacyUserId, "recurrings");
  const legacyEntries = read<LegacyEntry>(legacyUserId, "entries");
  const legacyRealizations = read<LegacyRealization>(
    legacyUserId,
    "realizations",
  );
  const legacyPlans = read<LegacyPlan>(legacyUserId, "plans");
  const legacyNotes = read<LegacyNote>(legacyUserId, "notes");

  // --- recurring types ---
  // The 'gasto' default already exists (created by a database trigger), so map
  // the legacy default id onto it instead of inserting a duplicate.
  const existingTypes = await store.getRecurringTypes(userId);
  const defaultType = existingTypes.find((t) => t.isDefault);
  const typeIdMap = new Map<string, string>();
  if (defaultType) typeIdMap.set(LEGACY_DEFAULT_TYPE_ID, defaultType.id);

  let importedTypes = 0;
  for (const legacy of legacyTypes) {
    if (typeIdMap.has(legacy.id)) continue;
    const saved = await store.saveRecurringType(userId, {
      label: legacy.label,
      direction: legacy.direction,
      isDefault: false,
    });
    typeIdMap.set(legacy.id, saved.id);
    importedTypes += 1;
  }

  // --- recurrings ---
  const anchor = anchorMonth(legacyEntries);
  const recurringIdMap = new Map<string, string>();
  for (const legacy of legacyRecurrings) {
    const typeId = typeIdMap.get(legacy.typeId) ?? defaultType?.id;
    if (!typeId) continue; // no type to attach it to; skip rather than corrupt
    const day = String(Math.min(Math.max(legacy.dayOfMonth, 1), 28)).padStart(
      2,
      "0",
    );
    const data: Omit<Recurring, "id" | "userId"> = {
      description: legacy.description,
      amount: legacy.amount,
      typeId,
      category: null,
      creditor: null, // the legacy model had no creditor
      url: legacy.url,
      priority: legacy.priority,
      active: legacy.active,
      frequency: "monthly",
      startDate: `${anchor}-${day}`,
      end: { kind: "never" },
    };
    const saved = await store.saveRecurring(userId, data);
    recurringIdMap.set(legacy.id, saved.id);
  }

  // --- entries ---
  // Two passes: insert everything first, then wire up dedup partners, which
  // point at other entries whose new ids only exist after the first pass.
  const entryIdMap = new Map<string, string>();
  for (const legacy of legacyEntries) {
    const data: Omit<Entry, "id" | "userId" | "createdAt"> = {
      description: legacy.description,
      amount: legacy.amount,
      date: legacy.date,
      direction: legacy.direction,
      category: legacy.category,
      source: legacy.source,
      bankTransactionId: legacy.bankTransactionId,
      dedupStatus: legacy.dedupStatus,
      realizesRecurringId: legacy.realizesRecurringId
        ? recurringIdMap.get(legacy.realizesRecurringId)
        : undefined,
    };
    const saved = await store.createEntry(userId, data);
    entryIdMap.set(legacy.id, saved.id);
  }

  for (const legacy of legacyEntries) {
    if (!legacy.dedupPartnerId) continue;
    const id = entryIdMap.get(legacy.id);
    const partnerId = entryIdMap.get(legacy.dedupPartnerId);
    if (id && partnerId) {
      await store.updateEntry(userId, id, { dedupPartnerId: partnerId });
    }
  }

  // --- realizations ---
  let importedRealizations = 0;
  for (const legacy of legacyRealizations) {
    const recurringId = recurringIdMap.get(legacy.recurringId);
    if (!recurringId) continue;
    const entryId = legacy.entryId ? entryIdMap.get(legacy.entryId) : undefined;
    // The database CHECK requires an entry for pending/confirmed; if the entry
    // did not survive the import, the realization no longer makes sense.
    if (legacy.status !== "assumed" && !entryId) continue;
    await store.saveRealization(userId, {
      recurringId,
      month: legacy.month,
      status: legacy.status,
      entryId,
    });
    importedRealizations += 1;
  }

  // --- plans ---
  let importedPlans = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const legacy of legacyPlans) {
    const targetRecurringId = recurringIdMap.get(legacy.targetRecurringId);
    if (!targetRecurringId) continue;
    const data: Omit<Plan, "id" | "userId"> = {
      title: legacy.title,
      targetRecurringId,
      monthlySaving: legacy.monthlySaving,
      goalId: null,
      // The legacy model only knew "done or not", so a finished plan gets
      // today's date. Goal progress derived from it starts counting now.
      doneAt: legacy.done ? today : null,
    };
    await store.savePlan(userId, data);
    importedPlans += 1;
  }

  // --- notes ---
  for (const legacy of legacyNotes) {
    const data: Omit<Note, "id" | "userId"> = {
      body: legacy.body,
      createdAt: legacy.createdAt,
    };
    await store.saveNote(userId, data);
  }

  return {
    recurringTypes: importedTypes,
    recurrings: recurringIdMap.size,
    entries: entryIdMap.size,
    realizations: importedRealizations,
    plans: importedPlans,
    notes: legacyNotes.length,
  };
}
