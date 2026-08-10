"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Already logged in -> skip the login screen.
  useEffect(() => {
    if (!isLoading && user) router.replace("/");
  }, [isLoading, user, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login(email); // mocked: any input logs in
    router.replace("/");
  }

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
          Entrar
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full">
          Entrar
        </Button>
      </form>
    </main>
  );
}
