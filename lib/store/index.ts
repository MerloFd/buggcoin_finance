// Single store instance. Components never talk to Supabase (or localStorage)
// directly — everything goes through this contract.

import { SupabaseStore } from "./supabaseStore";
import type { FinanceStore } from "./types";

export const store: FinanceStore = new SupabaseStore();

export * from "./types";
