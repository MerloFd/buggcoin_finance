// Accounts + transactions for one connected item.
//
// Returns raw bank data; turning it into Entries (and running the matching) is
// the client's job, because that is where the store and the user live.

import { NextResponse } from "next/server";
import { fetchBankData } from "@/lib/pluggy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How far back to sweep on a fetch. Wide enough to backfill a new connection,
// bounded so a first sync does not pull years of history.
const MONTHS_BACK = 3;

export async function GET(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json(
      { error: "itemId é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const from = new Date();
    from.setMonth(from.getMonth() - MONTHS_BACK);
    const data = await fetchBankData(itemId, from);
    return NextResponse.json(data);
  } catch (error) {
    console.error("transactions fetch failed", error);
    return NextResponse.json(
      { error: "Não foi possível buscar as transações." },
      { status: 500 },
    );
  }
}
