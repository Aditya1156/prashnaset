import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionProfile } from "@/lib/auth";
import { getActiveExam } from "@/lib/exam";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const exam = await getActiveExam(supabase, session.user.id);

  return (
    <AppShell
      displayName={session.displayName}
      email={session.user.email ?? ""}
      isAdmin={session.isAdmin}
      examOptions={exam.options}
      currentExam={exam.current}
    >
      {children}
    </AppShell>
  );
}
