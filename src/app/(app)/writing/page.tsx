import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WritingBank, type MainsCard } from "@/components/mains/writing-bank";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { getActiveExam } from "@/lib/exam";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Writing practice" };

export default async function WritingPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { current: exam } = await getActiveExam(supabase, session.user.id);

  const [{ data: questionRows }, { data: progressRows }] = await Promise.all([
    supabase
      .from("mains_questions")
      .select(
        "id, source, exam_label, exam_year, paper, section, type, marks, text_en, text_hi, directive, bihar_angle, topic, wording_status",
      )
      .eq("exam_id", exam?.id ?? "")
      .is("parent_question_id", null)
      .order("exam_year", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.rpc("my_mains_progress"),
  ]);

  const questions = (questionRows ?? []) as Record<string, unknown>[];

  // Best score per question, so a card can show where the learner stands.
  const { data: scored } = await supabase
    .from("mains_answers")
    .select("question_id, mains_evaluations(percent)")
    .eq("mode", "test")
    .not("submitted_at", "is", null);

  const bestByQuestion = new Map<string, number>();
  for (const row of (scored ?? []) as Record<string, unknown>[]) {
    const qid = row.question_id as string;
    const evals = (row.mains_evaluations ?? []) as { percent: number }[];
    for (const e of evals) {
      const current = bestByQuestion.get(qid);
      if (current === undefined || e.percent > current) bestByQuestion.set(qid, e.percent);
    }
  }

  const cards: MainsCard[] = questions.map((q) => ({
    id: q.id as string,
    source: q.source as MainsCard["source"],
    examLabel: (q.exam_label as string | null) ?? null,
    examYear: (q.exam_year as number | null) ?? null,
    paper: q.paper as string,
    section: (q.section as number | null) ?? null,
    type: q.type as string,
    marks: q.marks as number,
    textEn: (q.text_en as string | null) ?? null,
    textHi: (q.text_hi as string | null) ?? null,
    directive: (q.directive as string | null) ?? null,
    biharAngle: Boolean(q.bihar_angle),
    topic: (q.topic as string | null) ?? null,
    wordingStatus: (q.wording_status as MainsCard["wordingStatus"]) ?? "paraphrased",
    bestPercent: bestByQuestion.get(q.id as string) ?? null,
  }));

  const progress = (progressRows ?? []) as {
    paper: string;
    section: number | null;
    attempts: number;
    avg_percent: number | null;
    best_percent: number | null;
    avg_minutes: number | null;
  }[];

  return (
    <>
      <PageHeader
        overline="Mains"
        title="Writing practice"
        description="Answer a descriptive question on paper, photograph it, and get it marked against BPSC's rubric. Scores are an AI estimate at BPSC-style strictness — treat them as a direction, not a result."
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="No mains questions yet"
          body="Once previous-year questions are imported they appear here, filterable by paper, section and year."
        />
      ) : (
        <WritingBank cards={cards} progress={progress} />
      )}
    </>
  );
}
