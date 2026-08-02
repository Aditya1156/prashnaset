import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session?.isAdmin) redirect("/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const profiles = (data ?? []) as ProfileRow[];
  const learners = profiles.filter((p) => p.role !== "admin");
  const admins = profiles.filter((p) => p.role === "admin");

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with an account. Learners get the full test portal; admins additionally manage the library."
      >
        <p className="mt-3 text-sm text-muted tabular-nums" data-testid="users-summary">
          <span className="font-medium text-ink">{learners.length}</span>{" "}
          {plural(learners.length, "learner")}
          <span className="mx-1.5 text-faint">·</span>
          <span className="font-medium text-ink">{admins.length}</span>{" "}
          {plural(admins.length, "admin")}
        </p>
      </PageHeader>

      {profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts yet"
          body="Every sign-up appears here."
        />
      ) : (
        <Card className="divide-y divide-line" data-testid="users-list">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="truncate">{profile.display_name ?? "Unnamed"}</span>
                  {profile.role === "admin" && (
                    <Badge tone="accent" className="shrink-0">
                      <ShieldCheck className="size-3" aria-hidden /> Admin
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted">{profile.email ?? "—"}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                Joined {formatDate(profile.created_at)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
