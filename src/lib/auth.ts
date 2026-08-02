import type { SupabaseClient, User } from "@supabase/supabase-js";

export type Role = "user" | "admin";

export interface SessionProfile {
  user: User;
  displayName: string;
  role: Role;
  isAdmin: boolean;
}

/** Loads the signed-in user's profile (display name + role). Returns null
 *  when signed out. RLS is the real enforcement layer — this powers UI
 *  branching and friendly guard messages. */
export async function getSessionProfile(
  supabase: SupabaseClient,
): Promise<SessionProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  const role: Role = profile?.role === "admin" ? "admin" : "user";
  return {
    user,
    role,
    isAdmin: role === "admin",
    displayName:
      profile?.display_name?.trim() || user.email?.split("@")[0] || "Your account",
  };
}

/** Convenience for server actions that manage content. */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await getSessionProfile(supabase);
  if (!session) return { ok: false, error: "You need to be signed in." };
  if (!session.isAdmin) return { ok: false, error: "Only admins can manage content." };
  return { ok: true, userId: session.user.id };
}
