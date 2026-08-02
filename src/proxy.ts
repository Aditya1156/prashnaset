import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/import", "/sets", "/test", "/history"];
const AUTH_PAGES = ["/signin", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token when needed; do not run other logic before this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  const redirectTo = (pathname: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    if (next) url.searchParams.set("next", next);
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed session cookies along with the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && needsAuth) return redirectTo("/signin", path);
  if (user && AUTH_PAGES.includes(path)) return redirectTo("/dashboard");

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and public files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml|webmanifest)$).*)",
  ],
};
