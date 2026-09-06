import { ArrowLeft, Check, FileQuestion, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AiExplainButton } from "@/components/questions/ai-explain-button";
import { AiInsight } from "@/components/questions/ai-insight";
import { AnswerDisplay } from "@/components/questions/answer-display";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow, TestSessionRow } from "@/lib/types";
import { cn, formatDateTime, scorePercent, scoreTone } from "@/lib/utils";

export const metadata: Metadata = { title: "Review" };

const toneText = {
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
} as const;

export default async function ReviewPage(props: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await props.params;
  const supabase = await createClient();

  const { data: sessionData } = await supabase
    .from("test_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (!sessionData) notFound();
  const session = sessionData as TestSessionRow;
  if (!session.completed_at) redirect(`/test/${session.id}`);

  const { data: memberRows } = await supabase
    .from("session_questions")
    .select("sort_order, questions ( * )")
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });
  const questions = (memberRows ?? []).map(
    (row) => (row as unknown as { questions: QuestionRow | null }).questions,
  );

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("question_id, selected, is_correct")
    .eq("session_id", session.id);
  const attemptByQuestion = new Map(
    (attemptRows ?? []).map((row) => [
      row.question_id as string,
      { selected: row.selected as unknown, isCorrect: row.is_correct as boolean },
    ]),
  );

  const percent = scorePercent(session.correct_count, session.question_count);
  const missingCount = questions.filter((q) => q === null).length;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/history"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to history
      </Link>

      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
            {session.label ?? "Practice test"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Finished {formatDateTime(session.completed_at!)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "font-display text-4xl tabular-nums",
              toneText[scoreTone(percent)],
            )}
            data-testid="review-score"
          >
            {percent}%
          </p>
          <p className="text-xs text-muted tabular-nums">
            {session.correct_count} of {session.question_count} correct
          </p>
        </div>
      </div>

      {missingCount > 0 && (
        <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-ink">
          {missingCount} question{missingCount === 1 ? " was" : "s were"} deleted with{" "}
          {missingCount === 1 ? "its" : "their"} set and can&apos;t be shown anymore.
        </p>
      )}

      <div className="space-y-4">
        {questions.map((question, i) => {
          if (question === null) {
            return (
              <Card key={`missing-${i}`} className="p-5">
                <div className="flex items-center gap-2.5 text-muted">
                  <FileQuestion className="size-4" aria-hidden />
                  <p className="text-sm">Question {i + 1} — deleted with its set.</p>
                </div>
              </Card>
            );
          }
          const attempt = attemptByQuestion.get(question.id);
          const isCorrect = attempt?.isCorrect ?? false;
          return (
            <Card key={question.id} className="p-5" data-testid="review-question">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed font-medium text-ink">
                  <span className="mr-2 font-display text-faint tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {question.stem}
                </p>
                <Badge tone={isCorrect ? "success" : "danger"} className="shrink-0">
                  {isCorrect ? (
                    <>
                      <Check className="size-3" aria-hidden /> Correct
                    </>
                  ) : (
                    <>
                      <X className="size-3" aria-hidden /> Incorrect
                    </>
                  )}
                </Badge>
              </div>
              <div className="mt-4">
                <AnswerDisplay
                  question={question}
                  userSelected={attempt?.selected}
                  showUser={attempt !== undefined}
                />
              </div>
              {question.explanation && (
                <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm leading-relaxed text-muted">
                  <span className="font-medium text-ink">Why: </span>
                  {question.explanation}
                </p>
              )}
              {question.ai_explanation || question.ai_tip ? (
                <AiInsight
                  explanation={question.ai_explanation}
                  tip={question.ai_tip}
                  className="mt-3"
                />
              ) : (
                <AiExplainButton questionId={question.id} className="mt-3" />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
