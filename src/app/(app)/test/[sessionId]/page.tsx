import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TestRunner, type RunnerQuestion } from "@/components/test/runner";
import { createClient } from "@/lib/supabase/server";
import type { TestSessionRow } from "@/lib/types";

export const metadata: Metadata = { title: "Test" };

export default async function TestRunnerPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await props.params;
  const supabase = await createClient();

  const { data: sessionData } = await supabase
    .from("test_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (!sessionData) notFound();
  const session = sessionData as TestSessionRow;
  if (session.completed_at) redirect(`/history/${session.id}`);

  // Deliberately excludes `correct` and `explanation` — answers are revealed
  // only by the grading action after the user checks.
  const { data: memberRows } = await supabase
    .from("session_questions")
    .select("sort_order, questions ( id, type, stem, options )")
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });

  const questions: RunnerQuestion[] = (memberRows ?? [])
    .map((row) => (row as unknown as { questions: RunnerQuestion | null }).questions)
    .filter((q): q is RunnerQuestion => q !== null);

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("question_id")
    .eq("session_id", session.id);
  const answeredIds = (attemptRows ?? []).map((row) => row.question_id as string);

  return (
    <TestRunner
      sessionId={session.id}
      label={session.label ?? "Practice test"}
      questions={questions}
      initialAnsweredIds={answeredIds}
    />
  );
}
