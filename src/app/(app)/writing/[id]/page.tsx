import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AnswerWorkspace } from "@/components/mains/answer-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Write an answer" };

/** Marking makes several model calls, so this route needs more than the
 *  default serverless budget. */
export const maxDuration = 60;

export default async function WritingQuestionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { data: question } = await supabase
    .from("mains_questions")
    .select(
      "id, source, exam_label, exam_year, paper, section, type, marks, word_limit, text_en, text_hi, directive, bihar_angle, topic, model_answer",
    )
    .eq("id", id)
    .single();
  if (!question) notFound();

  const { data: history } = await supabase
    .from("mains_answers")
    .select("id, submitted_at, mode, word_count, time_taken_sec, mains_evaluations(percent, band, marks_awarded, marks_max)")
    .eq("question_id", id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(10);

  const attempts = ((history ?? []) as Record<string, unknown>[]).map((row) => {
    const evals = (row.mains_evaluations ?? []) as {
      percent: number;
      band: string;
      marks_awarded: number;
      marks_max: number;
    }[];
    const latest = evals[0];
    return {
      id: row.id as string,
      submittedAt: row.submitted_at as string,
      mode: row.mode as "study" | "test",
      wordCount: (row.word_count as number) ?? 0,
      percent: latest?.percent ?? null,
      band: latest?.band ?? null,
      marks: latest ? `${latest.marks_awarded}/${latest.marks_max}` : null,
    };
  });

  return (
    <>
      <PageHeader overline="Mains" title="Write an answer" />
      <AnswerWorkspace
        question={{
          id: question.id as string,
          paper: question.paper as string,
          section: (question.section as number | null) ?? null,
          type: question.type as string,
          marks: question.marks as number,
          wordLimit: (question.word_limit as number | null) ?? null,
          textEn: (question.text_en as string | null) ?? null,
          textHi: (question.text_hi as string | null) ?? null,
          directive: (question.directive as string | null) ?? null,
          biharAngle: Boolean(question.bihar_angle),
          topic: (question.topic as string | null) ?? null,
          examLabel: (question.exam_label as string | null) ?? null,
          examYear: (question.exam_year as number | null) ?? null,
          hasModelAnswer: Boolean(question.model_answer),
        }}
        attempts={attempts}
      />
    </>
  );
}
