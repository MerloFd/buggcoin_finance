"use client";

// Loads an async value into state. The store is remote now, so components that
// used to read it inline during render need this instead.
//
// `data` is null until the first load resolves. A pending request for stale
// dependencies is discarded rather than overwriting newer data.

import { useCallback, useEffect, useState, type DependencyList } from "react";

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped by `reload` so the effect re-runs without duplicating the fetch.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error("useAsync: load failed", error);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `loader` is intentionally excluded: callers pass an inline closure, so
    // including it would re-run on every render. `deps` is the real contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, reload };
}
