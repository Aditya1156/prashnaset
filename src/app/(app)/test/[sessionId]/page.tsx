import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TestRunner, type RunnerQuestion, type Selection } from "@/components/test/runner";
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
  // only by the grading action, and never at all in exam mode.
  const { data: memberRows } = await supabase
    .from("session_questions")
    .select("sort_order, marked, questions ( id, type, stem, options )")
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });

  const rows = (memberRows ?? []) as unknown as {
    marked: boolean;
    questions: RunnerQuestion | null;
  }[];
  const questions: RunnerQuestion[] = rows
    .map((row) => row.questions)
    .filter((q): q is RunnerQuestion => q !== null);
  const initialMarked = rows
    .filter((row) => row.marked && row.questions)
    .map((row) => row.questions!.id);

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("question_id, selected")
    .eq("session_id", session.id);

  const initialAnswers: Record<string, Selection> = {};
  for (const row of attemptRows ?? []) {
    initialAnswers[row.question_id as string] = row.selected as Selection;
  }

  const examMode = session.duration_seconds !== null || session.mode === "assigned";

  return (
    <TestRunner
      sessionId={session.id}
      label={session.label ?? "Practice test"}
      questions={questions}
      initialAnswers={initialAnswers}
      initialMarked={initialMarked}
      expiresAt={session.expires_at}
      examMode={examMode}
    />
  );
}
