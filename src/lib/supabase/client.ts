import { createBrowserClient } from "@supabase/ssr";

/** Works with both the new publishable key (sb_publishable_…) and the
 *  legacy anon key. Both are safe to expose to the browser; RLS is the gate.
 *
 *  `flowType: "implicit"` is deliberate. With PKCE, an emailed recovery link
 *  can only be opened in the exact browser that requested it (that browser
 *  holds the code_verifier) — so requesting a reset on a laptop and opening
 *  the mail on a phone always failed. Implicit delivers the session in the
 *  URL fragment instead, which works on any device. Switching back to PKCE
 *  requires custom SMTP so the email can carry a `token_hash` link to
 *  /auth/confirm, which is stateless and safe on either flow. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { flowType: "implicit", detectSessionInUrl: true } },
  );
}
