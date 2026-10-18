// Issues a short-lived token the browser widget uses to talk to Pluggy.
// The client id/secret never leave the server.

import { NextResponse } from "next/server";
import { getPluggyClient } from "@/lib/pluggy";

// The SDK does not run on the Edge runtime, and the response must never be
// cached — the token is short-lived.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // An itemId reconnects an existing connection instead of creating one.
    const body: unknown = await request.json().catch(() => ({}));
    const itemId =
      typeof body === "object" && body !== null && "itemId" in body
        ? String((body as { itemId: unknown }).itemId)
        : undefined;

    const client = getPluggyClient();
    const { accessToken } = await client.createConnectToken(itemId);
    return NextResponse.json({ accessToken });
  } catch (error) {
    console.error("connect-token failed", error);
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o banco." },
      { status: 500 },
    );
  }
}
