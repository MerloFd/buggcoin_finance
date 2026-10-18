// Turns bank transactions into Entries.
//
// Idempotent by `bankTransactionId`: re-fetching or reconnecting updates
// nothing and duplicates nothing — a transaction already imported is skipped.
// Without this, every reconnection would re-import the whole history.

import { runMatching } from "@/lib/matching";
import { store } from "@/lib/store";
import type { BankData, BankTransaction } from "@/lib/pluggy";

export interface ImportOutcome {
  imported: number;
  skipped: number;
}

// CREDIT is money in, DEBIT is money out. Never infer from the sign.
function directionOf(tx: BankTransaction): "in" | "out" {
  return tx.type === "CREDIT" ? "in" : "out";
}

export async function importBankData(
  userId: string,
  data: BankData,
): Promise<ImportOutcome> {
  const existing = await store.getEntries(userId);
  const alreadyImported = new Set(
    existing
      .map((e) => e.bankTransactionId)
      .filter((id): id is string => !!id),
  );

  let imported = 0;
  let skipped = 0;

  for (const tx of data.transactions) {
    if (alreadyImported.has(tx.id)) {
      skipped += 1;
      continue;
    }

    const entry = await store.createEntry(userId, {
      description: tx.description,
      amount: Math.abs(tx.amount),
      date: tx.date,
      direction: directionOf(tx),
      category: tx.category,
      source: "bank",
      bankTransactionId: tx.id,
      dedupStatus: null,
    });

    // Detection fires on every new Entry, wherever it came from — a bank
    // transaction can both duplicate a manual entry and fulfil a recurring.
    await runMatching(userId, entry.id);
    imported += 1;
  }

  return { imported, skipped };
}
