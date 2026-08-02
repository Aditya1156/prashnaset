import { createBrowserClient } from "@supabase/ssr";

/** Works with both the new publishable key (sb_publishable_…) and the
 *  legacy anon key. Both are safe to expose to the browser; RLS is the gate. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
