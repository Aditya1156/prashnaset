import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AssignmentCard,
  type AssignmentCardData,
} from "@/components/assignments/assignment-card";
import {
  CreateAssignmentButton,
  type AssignableBatch,
  type AssignableFolder,
  type AssignableLearner,
  type AssignableSet,
} from "@/components/assignments/assignment-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentRow, ProfileRow, TestSessionRow } from "@/lib/types";

export const metadata: Metadata = { title: "Assigned tests" };

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");
  const isAdmin = session.isAdmin;

  // RLS returns only assignments aimed at this account (admins see all).
  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("*")
    .order("created_at", { ascending: false });
  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const assignmentIds = assignments.map((a) => a.id);

  const batchIds = [...new Set(assignments.map((a) => a.batch_id).filter(Boolean))] as string[];
  const { data: batchNameRows } = batchIds.length > 0
    ? await supabase.from("batches").select("id, name").in("id", batchIds)
    : { data: [] as { id: string; name: string }[] };
  const batchNameMap = new Map((batchNameRows ?? []).map((b) => [b.id as string, b.name as string]));

  const [{ data: targetRows }, { data: sessionRows }] = await Promise.all([
    assignmentIds.length > 0
      ? supabase
          .from("assignment_targets")
          .select("assignment_id, user_id")
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] as { assignment_id: string; user_id: string }[] }),
    assignmentIds.length > 0
      ? supabase
          .from("test_sessions")
          .select("id, assignment_id, owner_id, completed_at, correct_count, question_count")
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] as Partial<TestSessionRow>[] }),
  ]);

  const targetCounts = new Map<string, number>();
  for (const row of targetRows ?? []) {
    const key = row.assignment_id as string;
    targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
  }

  const myAttempts = new Map<string, AssignmentCardData["myAttempt"]>();
  const completedCounts = new Map<string, number>();
  for (const row of (sessionRows ?? []) as Partial<TestSessionRow>[] & { assignment_id: string }[]) {
    const key = row.assignment_id as string;
    if (row.completed_at) completedCounts.set(key, (completedCounts.get(key) ?? 0) + 1);
    if (row.owner_id === session.user.id) {
      myAttempts.set(key, {
        sessionId: row.id as string,
        completed: row.completed_at !== null,
        correct: (row.correct_count as number) ?? 0,
        total: (row.question_count as number) ?? 0,
      });
    }
  }

  // This is a dynamic server route: it renders exactly once per request, so
  // reading the clock here is deterministic for that render. Deciding it on
  // the server also keeps the badge stable for the client component.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const cards: AssignmentCardData[] = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    instructions: a.instructions,
    questionCount: a.config?.count ?? 10,
    durationMinutes: a.duration_minutes,
    dueAt: a.due_at,
    assignAll: a.assign_all,
    batchName: a.batch_id ? (batchNameMap.get(a.batch_id) ?? null) : null,
    targetCount: targetCounts.get(a.id) ?? 0,
    myAttempt: myAttempts.get(a.id) ?? null,
    completedBy: isAdmin ? (completedCounts.get(a.id) ?? 0) : undefined,
    overdue: a.due_at !== null && new Date(a.due_at).getTime() < now,
  }));

  let sets: AssignableSet[] = [];
  let assignableFolders: AssignableFolder[] = [];
  let learners: AssignableLearner[] = [];
  let assignableBatches: AssignableBatch[] = [];
  if (isAdmin) {
    const [{ data: setRows }, { data: folderRows }, { data: profileRows }, { data: batchRows }] = await Promise.all([
      supabase
        .from("question_sets")
        .select("id, title, question_count, folder_id")
        .order("created_at", { ascending: false }),
      supabase.from("folders").select("id, name, color, icon").order("name"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("batches").select("id, name").eq("is_active", true).order("name"),
    ]);
    sets = (setRows ?? [])
      .filter((row) => (row.question_count as number) > 0)
      .map((row) => ({
        id: row.id as string,
        title: row.title as string,
        questionCount: row.question_count as number,
        folderId: (row.folder_id as string | null) ?? null,
      }));
    assignableFolders = (folderRows ?? []).map((f) => ({
      id: f.id as string,
      name: f.name as string,
      color: f.color as string,
      icon: f.icon as string,
    })) as AssignableFolder[];
    const profiles = (profileRows ?? []) as ProfileRow[];
    learners = profiles
      .filter((p) => p.role !== "admin")
      .map((p) => ({
        id: p.id,
        name: p.display_name ?? p.email?.split("@")[0] ?? "Learner",
        email: p.email ?? "—",
      }));
    const batchCounts = new Map<string, number>();
    for (const p of profiles) {
      if (p.batch_id) batchCounts.set(p.batch_id, (batchCounts.get(p.batch_id) ?? 0) + 1);
    }
    assignableBatches = (batchRows ?? []).map((b) => ({
      id: b.id as string,
      name: b.name as string,
      learnerCount: batchCounts.get(b.id as string) ?? 0,
    }));
  }

  return (
    <>
      <PageHeader
        overline={isAdmin ? "Cohort testing" : "Set for you"}
        title="Assigned tests"
        description={
          isAdmin
            ? "Design a test once and assign it to everyone or to chosen learners. Each learner gets their own attempt."
            : "Tests your admin has set for you. Timed tests open in exam mode with a countdown."
        }
        actions={isAdmin ? <CreateAssignmentButton sets={sets} folders={assignableFolders} learners={learners} batches={assignableBatches} /> : undefined}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={isAdmin ? "No assignments yet" : "Nothing assigned yet"}
          body={
            isAdmin
              ? "Assign a test to give every learner the same paper — timed, due-dated, and tracked."
              : "When your admin sets a test, it appears here. Meanwhile you can build your own from the library."
          }
        />
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <AssignmentCard key={card.id} assignment={card} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </>
  );
}
