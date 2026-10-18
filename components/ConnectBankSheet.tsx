"use client";

// Connect one or more banks through Pluggy. Meu Pluggy (free tier) allows up
// to 5 connections for the same account holder, so this lists them rather than
// treating a connection as a single on/off switch.
//
// Disconnected is the normal state and must never look like an error — the app
// is complete without ever connecting anything.

import { useState } from "react";
import dynamic from "next/dynamic";
import { Landmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAsync } from "@/hooks/useAsync";
import { importBankData } from "@/lib/bankImport";
import { store } from "@/lib/store";
import type { BankData } from "@/lib/pluggy";

// The widget touches `window` on load, so it must not be server-rendered.
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false },
);

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "connecting"; token: string }
  | { kind: "importing" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export function ConnectBankSheet({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const { data: connections, reload } = useAsync(
    () => store.getConnections(userId),
    [userId, open],
  );

  async function startConnection() {
    setStatus({ kind: "starting" });
    try {
      const response = await fetch("/api/connect-token", { method: "POST" });
      if (!response.ok) throw new Error("Falha ao iniciar a conexão.");
      const { accessToken } = (await response.json()) as {
        accessToken: string;
      };
      setStatus({ kind: "connecting", token: accessToken });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Não foi possível conectar.",
      });
    }
  }

  async function handleSuccess(itemId: string, institution: string | null) {
    setStatus({ kind: "importing" });
    try {
      await store.saveConnection(userId, itemId, institution);

      const response = await fetch(
        `/api/transactions?itemId=${encodeURIComponent(itemId)}`,
      );
      if (!response.ok) throw new Error("Falha ao buscar as transações.");
      const data = (await response.json()) as BankData;

      const { imported, skipped } = await importBankData(userId, data);
      reload();
      setStatus({
        kind: "done",
        message:
          imported === 0
            ? "Banco conectado. Nenhuma transação nova."
            : `Banco conectado. ${imported} transação(ões) importada(s)${
                skipped > 0 ? `, ${skipped} já existiam` : ""
              }.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Conectado, mas não foi possível importar as transações.",
      });
    }
  }

  async function disconnect(itemId: string) {
    await store.removeConnection(userId, itemId);
    reload();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="font-heading">Conectar banco</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Opcional. O app funciona inteiro com lançamentos manuais — conectar
            um banco só traz as transações automaticamente. Os dados chegam com
            até 24h de atraso, então o lançamento manual continua sendo o
            caminho rápido.
          </p>

          {connections && connections.length > 0 && (
            <ul className="space-y-2">
              {connections.map((connection) => (
                <li
                  key={connection.itemId}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Landmark
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {connection.institution ?? "Banco conectado"}
                  </span>
                  <button
                    type="button"
                    aria-label="Desconectar"
                    onClick={() => disconnect(connection.itemId)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status.kind === "error" && (
            <p
              role="alert"
              className="rounded-md border border-border px-3 py-2 text-sm"
              style={{ color: "var(--expense)" }}
            >
              {status.message}
            </p>
          )}

          {status.kind === "done" && (
            <p className="rounded-md border border-border px-3 py-2 text-sm">
              {status.message}
            </p>
          )}

          {status.kind !== "connecting" && (
            <Button
              className="w-full"
              onClick={startConnection}
              disabled={status.kind === "starting" || status.kind === "importing"}
            >
              {status.kind === "starting"
                ? "Abrindo…"
                : status.kind === "importing"
                  ? "Importando transações…"
                  : "Conectar banco"}
            </Button>
          )}

          {status.kind === "connecting" && (
            <PluggyConnect
              connectToken={status.token}
              includeSandbox
              onSuccess={(data) => {
                const item = data.item as {
                  id: string;
                  connector?: { name?: string };
                };
                void handleSuccess(item.id, item.connector?.name ?? null);
              }}
              onError={(error) =>
                setStatus({
                  kind: "error",
                  message: error.message || "Não foi possível conectar.",
                })
              }
              onClose={() => setStatus({ kind: "idle" })}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
