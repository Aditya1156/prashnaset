import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteSetButton } from "@/components/sets/delete-set-button";
import { QuestionItem } from "@/components/sets/question-item";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow, QuestionSetRow } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Set" };

export default async function SetDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: setData } = await supabase
    .from("question_sets")
    .select("*")
    .eq("id", id)
    .single();
  if (!setData) notFound();
  const set = setData as QuestionSetRow;

  const { data: questionData } = await supabase
    .from("questions")
    .select("*")
    .eq("set_id", id)
    .eq("status", "active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const questions = (questionData ?? []) as QuestionRow[];

  return (
    <>
      <PageHeader
        title={set.title}
        actions={
          <>
            {questions.length > 0 && (
              <ButtonLink href={`/test/new?set=${set.id}`}>Test this set</ButtonLink>
            )}
            <DeleteSetButton setId={set.id} title={set.title} questionCount={questions.length} />
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">
            {questions.length} {plural(questions.length, "question")}
          </Badge>
          <Badge>{set.language === "hi" ? "Hindi" : "English"}</Badge>
          <span className="text-xs text-muted">Imported {formatDate(set.created_at)}</span>
        </div>
      </PageHeader>

      {questions.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No active questions left"
          body="Every question in this set has been removed. Import a fresh file, or delete the set."
          action={<ButtonLink href="/import">Import questions</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <QuestionItem key={question.id} question={question} index={index} />
          ))}
        </div>
      )}
    </>
  );
}
