"use client";

// Mocked session. Lives OUTSIDE the FinanceStore: the session is a device
// preference (like the theme), and the `userId` every store method needs is
// read from here. This is the sanctioned exception to the "no direct
// localStorage" rule, same as next-themes.
// TODO: real auth.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface Session {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: Session | null;
  isLoading: boolean; // true until the stored session has been read on mount
  login: (email: string) => void;
  logout: () => void;
}

const SESSION_KEY = "finance:session";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Read the persisted session once, after hydration.
  useEffect(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw) as Session);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string) => {
    // No real validation. Any input logs in.
    const session: Session = { id: "local-user", email };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
