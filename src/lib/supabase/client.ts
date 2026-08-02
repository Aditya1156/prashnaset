import { createBrowserClient } from "@supabase/ssr";

/** Works with both the new publishable key (sb_publishable_…) and the
 *  legacy anon key. Both are safe to expose to the browser; RLS is the gate.
 *
 *  Note: @supabase/ssr hardcodes `flowType: "pkce"` after spreading any auth
 *  options, so the flow cannot be changed here — and its PKCE guard ignores
 *  implicit-style tokens in the URL fragment. Recovery links that arrive as
 *  fragment tokens are therefore consumed explicitly in the update-password
 *  form rather than by `detectSessionInUrl`. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
