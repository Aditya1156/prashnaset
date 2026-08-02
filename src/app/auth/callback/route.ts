import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PKCE callback: exchanges a `?code=` for a session. This only succeeds in
 *  the browser that started the flow (it holds the code_verifier), so email
 *  links use the stateless /auth/confirm route instead. Kept for OAuth and
 *  for links opened in the requesting browser. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // Some Supabase email templates deliver token_hash here — forward it to the
  // stateless handler rather than failing the exchange.
  if (!code && tokenHash && type) {
    const forward = new URL(`${origin}/auth/confirm`);
    forward.searchParams.set("token_hash", tokenHash);
    forward.searchParams.set("type", type);
    forward.searchParams.set("next", safeNext);
    return NextResponse.redirect(forward);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/signin?error=link`);
}
