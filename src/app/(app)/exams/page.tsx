import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExamManager } from "@/components/exams/exam-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage Exams" };

interface ExamRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default async function ExamsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");
  if (!session.isAdmin) redirect("/dashboard");

  const [{ data: examRows }, { data: folderRows }, { data: setRows }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, name, description, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("folders").select("exam_id"),
    supabase.from("question_sets").select("exam_id, question_count"),
  ]);

  const exams = (examRows ?? []) as ExamRow[];

  // An exam holding content cannot be deleted — the foreign keys restrict —
  // so the counts below are what the delete dialog explains.
  const folderCount = new Map<string, number>();
  for (const row of folderRows ?? []) {
    const key = row.exam_id as string | null;
    if (key) folderCount.set(key, (folderCount.get(key) ?? 0) + 1);
  }
  const setCount = new Map<string, number>();
  const questionCount = new Map<string, number>();
  for (const row of setRows ?? []) {
    const key = row.exam_id as string | null;
    if (!key) continue;
    setCount.set(key, (setCount.get(key) ?? 0) + 1);
    questionCount.set(key, (questionCount.get(key) ?? 0) + (row.question_count as number));
  }

  return (
    <>
      <PageHeader
        overline="Admin"
        title="Manage Exams"
        description="Each exam is a separate track. Learners switch between them without signing out, and only ever see the library for the one they are preparing for."
      />
      <ExamManager
        exams={exams.map((exam) => ({
          id: exam.id,
          name: exam.name,
          description: exam.description,
          isActive: exam.is_active,
          folderCount: folderCount.get(exam.id) ?? 0,
          setCount: setCount.get(exam.id) ?? 0,
          questionCount: questionCount.get(exam.id) ?? 0,
        }))}
      />
    </>
  );
}
