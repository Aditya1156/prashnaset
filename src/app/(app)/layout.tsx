import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  return (
    <AppShell
      displayName={session.displayName}
      email={session.user.email ?? ""}
      isAdmin={session.isAdmin}
    >
      {children}
    </AppShell>
  );
}
