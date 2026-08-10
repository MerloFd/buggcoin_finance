"use client";

// Client-side route guard. The session lives in localStorage (not a cookie),
// so the server can't see it — the guard runs on the client instead of in
// middleware. No session -> redirect to /login.

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  // Avoid flashing protected content before the session is known / redirect fires.
  if (isLoading || !user) return null;

  return <>{children}</>;
}
