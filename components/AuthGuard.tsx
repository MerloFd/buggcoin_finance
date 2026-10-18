"use client";

// Client-side route guard. The Supabase session lives in a cookie, so a
// middleware could read it — but the whole app renders on the client and no
// server route reads user data, so guarding here is enough (see Task 13,
// step 4). No session -> redirect to /login.

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
