import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MainsManager, type ManagedQuestion } from "@/components/mains/mains-manager";
import { PageHeader } from "@/components/ui/page-header";
import { describeProvider } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { getActiveExam } from "@/lib/exam";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage mains questions" };

/** Generating a model answer is a model call, so this route needs more than
 *  the default serverless budget. */
export const maxDuration = 60;

export default async function ManageMainsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");
  if (!session.isAdmin) redirect("/writing");

  const { current: exam } = await getActiveExam(supabase, session.user.id);

  const { data: rows } = await supabase
    .from("mains_questions")
    .select(
      "id, source, exam_label, exam_year, paper, section, type, marks, word_limit, text_en, text_hi, directive, bihar_angle, topic, model_answer, model_answer_model, model_answer_at",
    )
    .eq("exam_id", exam?.id ?? "")
    .neq("source", "USER")
    .order("exam_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const questions: ManagedQuestion[] = ((rows ?? []) as Record<string, unknown>[]).map((q) => ({
    id: q.id as string,
    paper: q.paper as ManagedQuestion["paper"],
    section: (q.section as number | null) ?? null,
    type: q.type as ManagedQuestion["type"],
    marks: q.marks as number,
    wordLimit: (q.word_limit as number | null) ?? null,
    textEn: (q.text_en as string | null) ?? null,
    textHi: (q.text_hi as string | null) ?? null,
    directive: (q.directive as string | null) ?? null,
    biharAngle: Boolean(q.bihar_angle),
    topic: (q.topic as string | null) ?? null,
    examLabel: (q.exam_label as string | null) ?? null,
    examYear: (q.exam_year as number | null) ?? null,
    modelAnswer: (q.model_answer as string | null) ?? null,
    // Null model on a stored answer means a human wrote it.
    modelAnswerIsAi: Boolean(q.model_answer && q.model_answer_model),
  }));

  return (
    <>
      <PageHeader
        overline="Admin"
        title="Mains questions"
        description={
          exam
            ? `Descriptive questions for ${exam.name}. Import a file, add one by hand, and give each a model answer — written yourself or generated.`
            : "Descriptive questions for the current exam track."
        }
      />
      <MainsManager questions={questions} provider={describeProvider()} />
    </>
  );
}
