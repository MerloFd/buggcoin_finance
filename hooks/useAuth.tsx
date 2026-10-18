"use client";

// Real session, backed by Supabase Auth.
//
// The session lives in cookies (written by @supabase/ssr), not in app code —
// nothing here touches localStorage. The `userId` every store method takes is
// `session.user.id`: a real uuid that Row Level Security matches against.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface Session {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: Session | null;
  isLoading: boolean; // true until the stored session has been read
  signIn: (email: string, password: string) => Promise<void>;
  // Resolves with needsConfirmation=true when the project requires the user to
  // click a link in their email before the account can be used.
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(session: SupabaseSession | null): Session | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? "" };
}

// Supabase returns English messages; the UI is pt-BR.
function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("already registered")) {
    return "Este e-mail já tem uma conta. Tente entrar.";
  }
  if (normalized.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Sua conta existe, mas o e-mail ainda não foi confirmado. Clique no link que enviamos.";
  }
  // The built-in Supabase mailer allows only 2 emails per hour. The account is
  // created before the email is sent, so it almost certainly already exists.
  if (
    normalized.includes("rate limit") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "Limite de e-mails do Supabase atingido (2 por hora). Sua conta provavelmente já foi criada — tente entrar em vez de cadastrar.";
  }
  if (normalized.includes("unable to validate email")) {
    return "E-mail inválido.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(toSession(data.session));
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        console.error("useAuth: failed to read session", error);
        if (active) setIsLoading(false);
      });

    // Fires on sign-in, sign-out and token refresh — keeps this provider in
    // sync with the cookie without polling.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSession(session));
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(friendlyAuthError(error.message));
    // No session means the project has email confirmation switched on.
    return { needsConfirmation: data.session === null };
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
