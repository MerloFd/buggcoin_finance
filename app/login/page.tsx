"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in -> skip the login screen.
  useEffect(() => {
    if (!isLoading && user) router.replace("/");
  }, [isLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice(
            "Conta criada. Confirme o e-mail que enviamos para poder entrar.",
          );
          setMode("signin");
          return;
        }
      } else {
        await signIn(email, password);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-col items-center gap-3 pb-2">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">
            Controle o quanto você ainda pode gastar.
          </p>
        </div>
        <h1 className="font-heading text-xl font-semibold text-card-foreground">
          {isSignup ? "Criar conta" : "Entrar"}
        </h1>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-muted-foreground">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Senha
          </label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {isSignup && (
            <p className="text-xs text-muted-foreground">
              Pelo menos 6 caracteres.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-border px-3 py-2 text-sm"
            style={{ color: "var(--expense)" }}
          >
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError(null);
            setNotice(null);
          }}
        >
          {isSignup
            ? "Já tenho conta. Entrar"
            : "Não tenho conta. Criar uma agora"}
        </button>
      </form>
    </main>
  );
}
