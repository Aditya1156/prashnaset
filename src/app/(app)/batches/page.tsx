import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BatchManager } from "@/components/batches/batch-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BatchRow, ProfileRow } from "@/lib/types";

export const metadata: Metadata = { title: "Manage Batches" };

export default async function BatchesPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");
  if (!session.isAdmin) redirect("/dashboard");

  const [{ data: batchRows }, { data: profileRows }, { data: assignmentRows }] = await Promise.all([
    supabase.from("batches").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, display_name, email, batch_id, role"),
    supabase.from("assignments").select("batch_id").not("batch_id", "is", null),
  ]);

  const batches = (batchRows ?? []) as BatchRow[];
  const profiles = (profileRows ?? []) as Pick<ProfileRow, "id" | "display_name" | "email" | "batch_id" | "role">[];

  // Deleting a batch nulls assignments.batch_id, which silently hides those
  // papers from everyone — so the delete confirmation needs this count.
  const assignmentsByBatch = new Map<string, number>();
  for (const row of assignmentRows ?? []) {
    const key = row.batch_id as string;
    assignmentsByBatch.set(key, (assignmentsByBatch.get(key) ?? 0) + 1);
  }

  const learnersByBatch = new Map<string, { id: string; name: string; email: string }[]>();
  const unassignedLearners: { id: string; name: string; email: string }[] = [];

  for (const p of profiles) {
    if (p.role === "admin") continue;
    const entry = {
      id: p.id,
      name: p.display_name ?? p.email?.split("@")[0] ?? "Learner",
      email: p.email ?? "—",
    };
    if (p.batch_id) {
      const list = learnersByBatch.get(p.batch_id) ?? [];
      list.push(entry);
      learnersByBatch.set(p.batch_id, list);
    } else {
      unassignedLearners.push(entry);
    }
  }

  const batchData = batches.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    isActive: b.is_active,
    learners: learnersByBatch.get(b.id) ?? [],
    assignmentCount: assignmentsByBatch.get(b.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        overline="Admin"
        title="Manage Batches"
        description="Create batches for different cohorts. Assign tests to an entire batch at once."
      />

      <BatchManager batches={batchData} unassigned={unassignedLearners} />
    </>
  );
}
