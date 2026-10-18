"use client";

// Offers to bring over the data the app kept in the browser before it had
// accounts. Inline and persistent (never a toast) — the user may want to
// decide later, and the offer must still be there when they come back.

import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  importLegacyData,
  inspectLegacyData,
  type LegacySummary,
} from "@/lib/store/legacyImport";

// Remembers a dismissal so the banner does not nag. Device preference, like
// the theme — not domain data, so it does not belong in the store.
const DISMISSED_KEY = "finance:legacy-import-dismissed";

type State = "idle" | "importing" | "done" | "error";

export function LegacyImportBanner() {
  const { user } = useAuth();
  const userId = user?.id;

  const [legacy, setLegacy] = useState<LegacySummary | null>(null);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Storage blocked; just show the banner.
    }
    setLegacy(inspectLegacyData());
  }, [userId]);

  if (!userId || !legacy) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do — the banner simply reappears next time.
    }
    setLegacy(null);
  }

  async function runImport() {
    if (!legacy || !userId) return;
    setState("importing");
    setMessage(null);
    try {
      const result = await importLegacyData(userId, legacy.legacyUserId);
      setState("done");
      setMessage(
        `Importado: ${result.entries} lançamentos, ${result.recurrings} recorrentes, ${result.notes} anotações.`,
      );
      // Keep the old data in the browser untouched, but stop offering it.
      try {
        window.localStorage.setItem(DISMISSED_KEY, "1");
      } catch {
        // Ignored.
      }
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível importar os dados.",
      );
    }
  }

  return (
    <div className="border-b border-border bg-secondary">
      <div className="mx-auto max-w-md px-4 py-3 lg:max-w-3xl">
        <div className="flex items-start gap-3">
          <Upload
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-2">
            {state === "done" ? (
              <p className="text-sm">{message}</p>
            ) : (
              <>
                <p className="text-sm">
                  Encontramos dados salvos neste navegador:{" "}
                  <strong>{legacy.entries} lançamentos</strong>,{" "}
                  {legacy.recurrings} recorrentes e {legacy.notes} anotações.
                  Quer trazer para a sua conta?
                </p>
                {state === "error" && message && (
                  <p role="alert" className="text-sm" style={{ color: "var(--expense)" }}>
                    {message}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={runImport}
                    disabled={state === "importing"}
                  >
                    {state === "importing" ? "Importando…" : "Importar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={dismiss}>
                    Agora não
                  </Button>
                </div>
              </>
            )}
          </div>
          {state === "done" && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setLegacy(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
