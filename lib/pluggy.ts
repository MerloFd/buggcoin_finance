// Server-side Pluggy client (singleton).
//
// CLIENT_ID / CLIENT_SECRET live only here. Never import this file from a
// client component — it would leak the secret into the browser bundle.
//
// Signatures below were read from node_modules/pluggy-sdk/dist/**/*.d.ts at
// version 0.88.0. Notably `fetchTransactions` is DEPRECATED in this version:
// use `fetchAllTransactions`, which sweeps the cursor-paginated endpoint and
// returns a plain array.

import { PluggyClient } from "pluggy-sdk";

const clientId = process.env.PLUGGY_CLIENT_ID;
const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

// Cached across hot reloads in dev, where module state is otherwise recreated
// on every request and would re-authenticate each time.
const globalForPluggy = globalThis as unknown as {
  pluggyClient?: PluggyClient;
};

export function getPluggyClient(): PluggyClient {
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET in .env.local",
    );
  }
  globalForPluggy.pluggyClient ??= new PluggyClient({ clientId, clientSecret });
  return globalForPluggy.pluggyClient;
}

// --- Our own transport types ---
//
// The SDK hands back `date` as a Date object; JSON turns it into a string, so
// the wire shape is declared explicitly instead of reusing the SDK type.

export interface BankAccount {
  id: string;
  type: "BANK" | "CREDIT";
  subtype: "SAVINGS_ACCOUNT" | "CHECKING_ACCOUNT" | "CREDIT_CARD";
  name: string;
  number: string;
  balance: number;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string; // ISO date, 'YYYY-MM-DD'
  description: string;
  amount: number; // always positive; direction comes from `type`
  type: "DEBIT" | "CREDIT";
  category: string | null;
}

export interface BankData {
  accounts: BankAccount[];
  transactions: BankTransaction[];
}

/** Accounts plus every transaction since `from`, for one connected item. */
export async function fetchBankData(
  itemId: string,
  from: Date,
): Promise<BankData> {
  const client = getPluggyClient();

  const accountsPage = await client.fetchAccounts(itemId);
  const accounts: BankAccount[] = accountsPage.results.map((account) => ({
    id: account.id,
    type: account.type,
    subtype: account.subtype,
    name: account.name,
    number: account.number,
    balance: account.balance,
  }));

  const transactions: BankTransaction[] = [];
  for (const account of accounts) {
    // `dateFrom`, not `from`: the cursor-based API uses a different filter
    // shape than the deprecated page-based `fetchTransactions`.
    const list = await client.fetchAllTransactions(account.id, {
      dateFrom: from.toISOString().slice(0, 10),
    });
    for (const tx of list) {
      transactions.push({
        id: tx.id,
        accountId: tx.accountId,
        // The SDK returns a Date; normalise to a plain ISO day.
        date: new Date(tx.date).toISOString().slice(0, 10),
        description: tx.description,
        // Never trust the sign — direction is carried by `type`.
        amount: Math.abs(tx.amount),
        type: tx.type,
        category: tx.category,
      });
    }
  }

  return { accounts, transactions };
}
