import { FileQuestion, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { DeleteSetButton } from "@/components/sets/delete-set-button";
import { EditSetButton } from "@/components/sets/edit-set-button";
import { GenerateAiButton } from "@/components/sets/generate-ai-button";
import { MoveSetButton } from "@/components/sets/folder-controls";
import { QuestionItem } from "@/components/sets/question-item";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { describeProvider } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { folderColorStyle, folderIconComponent } from "@/lib/folder-style";
import { AI_BATCH_SIZE } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import type { FolderRow, QuestionRow, QuestionSetRow } from "@/lib/types";
import { cn, formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Set" };

const typeLabels = { mcq: "MCQ", msq: "MSQ", match: "Match" } as const;
const difficultyTones = { easy: "success", medium: "neutral", hard: "warn" } as const;

export default async function SetDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  const isAdmin = session?.isAdmin ?? false;

  const { data: setData } = await supabase
    .from("question_sets")
    .select("*")
    .eq("id", id)
    .single();
  if (!setData) notFound();
  const set = setData as QuestionSetRow;

  const [{ data: questionData }, { data: folderData }] = await Promise.all([
    supabase
      .from("questions")
      .select("*")
      .eq("set_id", id)
      .eq("status", "active")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("folders").select("*").order("name", { ascending: true }),
  ]);
  const questions = (questionData ?? []) as QuestionRow[];
  const folders = (folderData ?? []) as FolderRow[];
  const currentFolder = folders.find((f) => f.id === set.folder_id) ?? null;
  const currentFolderIcon = currentFolder ? folderIconComponent(currentFolder.icon) : null;

  return (
    <>
      <PageHeader
        title={set.title}
        actions={
          <>
            {questions.length > 0 && (
              <ButtonLink href={`/test/new?set=${set.id}`}>
                <Play className="size-4" aria-hidden />
                {isAdmin ? "Test this set" : "Practice this set"}
              </ButtonLink>
            )}
            {isAdmin && (
              <>
                <GenerateAiButton
                  setId={set.id}
                  missingCount={questions.filter((q) => !q.ai_explanation).length}
                  batchSize={AI_BATCH_SIZE}
                  provider={describeProvider()}
                />
                <EditSetButton
                  setId={set.id}
                  title={set.title}
                  language={set.language}
                />
                <MoveSetButton
                  setId={set.id}
                  setTitle={set.title}
                  currentFolderId={set.folder_id}
                  folders={folders.map((f) => ({ id: f.id, name: f.name }))}
                />
                <DeleteSetButton
                  setId={set.id}
                  title={set.title}
                  questionCount={questions.length}
                />
              </>
            )}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {currentFolder && currentFolderIcon && (
            <Link
              href={`/sets/folder/${currentFolder.id}`}
              data-testid="folder-badge"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity hover:opacity-80",
                folderColorStyle(currentFolder.color).chip,
              )}
            >
              {createElement(currentFolderIcon, { className: "size-3", "aria-hidden": true })}{" "}
              {currentFolder.name}
            </Link>
          )}
          <Badge tone="accent">
            {questions.length} {plural(questions.length, "question")}
          </Badge>
          <Badge>{set.language === "hi" ? "Hindi" : "English"}</Badge>
          <span className="text-xs text-muted">Added {formatDate(set.created_at)}</span>
        </div>
        {!isAdmin && questions.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Answers and explanations are revealed while you practice — question by question.
          </p>
        )}
      </PageHeader>

      {questions.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No active questions left"
          body={
            isAdmin
              ? "Every question in this set has been removed. Import a fresh file, or delete the set."
              : "This set is currently empty."
          }
          action={isAdmin ? <ButtonLink href="/import">Import questions</ButtonLink> : undefined}
        />
      ) : isAdmin ? (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <QuestionItem key={question.id} question={question} index={index} />
          ))}
        </div>
      ) : (
        <ol className="space-y-2" data-testid="question-preview-list">
          {questions.map((question, index) => (
            <li
              key={question.id}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
            >
              <span className="mt-0.5 font-display text-sm text-faint tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{question.stem}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{typeLabels[question.type]}</Badge>
                  <Badge tone={difficultyTones[question.difficulty]}>
                    {question.difficulty}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
