import { BookOpen, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PyqCard } from "@/components/pyq/pyq-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Previous Year Papers" };

interface PaperGroup {
  examYear: number;
  examName: string;
  questionCount: number;
  topics: string[];
}

export default async function PyqPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { data: rows } = await supabase
    .from("questions")
    .select("exam_year, exam_name, topic")
    .eq("status", "active")
    .not("exam_year", "is", null);

  const groupMap = new Map<string, PaperGroup>();
  for (const row of rows ?? []) {
    const year = row.exam_year as number;
    const name = (row.exam_name as string | null) ?? "BPSC Prelims";
    const key = `${year}|${name}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.questionCount += 1;
      if (row.topic && !existing.topics.includes(row.topic as string)) {
        existing.topics.push(row.topic as string);
      }
    } else {
      groupMap.set(key, {
        examYear: year,
        examName: name,
        questionCount: 1,
        topics: row.topic ? [row.topic as string] : [],
      });
    }
  }

  const papers = [...groupMap.values()].sort((a, b) => b.examYear - a.examYear);
  const totalPyqs = papers.reduce((sum, p) => sum + p.questionCount, 0);

  return (
    <>
      <PageHeader
        overline="Exam archive"
        title="Previous Year Papers"
        description="Practice with real questions from past exams. The most reliable way to prepare — what was asked once is often asked again."
        actions={<ButtonLink href="/test/new">Build a custom test</ButtonLink>}
      />

      {papers.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No previous-year questions yet"
          body="Questions tagged with an exam year will appear here as ready-to-take mock papers."
          action={
            session.isAdmin ? (
              <ButtonLink href="/import">Import questions</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-on-navy">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">
                  {papers.length} {plural(papers.length, "paper")} available
                </p>
                <p className="text-xs text-muted">
                  {totalPyqs} {plural(totalPyqs, "question")} from past exams
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {papers.map((paper) => (
              <PyqCard
                key={`${paper.examYear}-${paper.examName}`}
                examYear={paper.examYear}
                examName={paper.examName}
                questionCount={paper.questionCount}
                topics={paper.topics}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
