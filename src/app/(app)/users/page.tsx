import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  InviteUserButton,
  UsersDirectory,
  type DirectoryUser,
} from "@/components/users/users-directory";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

const DESIGNATED_ADMIN_EMAIL = "adityaissc7@gmail.com";

export default async function UsersPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session?.isAdmin) redirect("/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const profiles = (data ?? []) as ProfileRow[];

  const users: DirectoryUser[] = profiles.map((profile) => ({
    id: profile.id,
    name: profile.display_name ?? profile.email?.split("@")[0] ?? "Unnamed",
    email: profile.email ?? "—",
    isAdmin: profile.role === "admin",
    joinedAt: profile.created_at,
  }));
  const adminCount = users.filter((u) => u.isAdmin).length;
  const learnerCount = users.length - adminCount;

  return (
    <>
      <PageHeader
        overline="Administrative control"
        title="Users"
        description="Everyone with an account. Learners get the full test portal; admins additionally manage the library and users."
        actions={<InviteUserButton />}
      >
        <p className="mt-3 flex items-center gap-4 text-sm text-muted tabular-nums" data-testid="users-summary">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent-fill" aria-hidden />
            <span className="font-medium text-ink">{learnerCount}</span>{" "}
            {plural(learnerCount, "Learner")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-navy" aria-hidden />
            <span className="font-medium text-ink">{adminCount}</span>{" "}
            {plural(adminCount, "Admin")}
          </span>
        </p>
      </PageHeader>

      <UsersDirectory
        users={users}
        selfId={session.user.id}
        designatedEmail={DESIGNATED_ADMIN_EMAIL}
      />
    </>
  );
}
