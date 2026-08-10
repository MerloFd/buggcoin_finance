// Single store instance. Swapping the implementation here is the ONLY change
// needed when the real database (Supabase) replaces localStorage.

import { LocalStorageStore } from "./localStorageStore";
import type { FinanceStore } from "./types";

export const store: FinanceStore = new LocalStorageStore();

export * from "./types";
