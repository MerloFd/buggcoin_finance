// Browser Supabase client (module singleton).
//
// The anon key is public by design — Row Level Security is what protects the
// rows, not the secrecy of this key.
//
// No `cookies` option is passed on purpose: in a browser runtime @supabase/ssr
// falls back to `document.cookie`, which is what we want. The session lives in
// cookies rather than localStorage, so it survives reloads and stays readable
// server-side if we ever add a middleware.

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy them from the Supabase dashboard into .env.local.",
  );
}

export const supabase = createBrowserClient(url, anonKey);
