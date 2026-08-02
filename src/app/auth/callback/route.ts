import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the one-time code from Supabase auth links (password reset,
 *  email confirmation) for a session, then forwards to the intended page. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/signin?error=link`);
}
