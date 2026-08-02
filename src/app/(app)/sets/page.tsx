import { ChevronRight, Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateFolderButton } from "@/components/sets/folder-controls";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { folderColorStyle, folderIconComponent } from "@/lib/folder-style";
import { createClient } from "@/lib/supabase/server";
import type { FolderRow, QuestionSetRow } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Library" };

interface FolderSummary {
  setCount: number;
  questionCount: number;
}

function FolderCard({
  href,
  name,
  tileClass,
  icon: Icon,
  summary,
  testId,
}: {
  href: string;
  name: string;
  tileClass: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  summary: FolderSummary;
  testId: string;
}) {
  return (
    <Link href={href} data-testid={testId} className="group block">
      <Card className="flex h-full items-center gap-4 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-md sm:p-5">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            tileClass,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg text-ink">{name}</span>
          <span className="mt-0.5 block text-sm text-muted tabular-nums">
            {summary.setCount} {plural(summary.setCount, "set")} · {summary.questionCount}{" "}
            {plural(summary.questionCount, "question")}
          </span>
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Card>
    </Link>
  );
}

export default async function SetsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  const isAdmin = session?.isAdmin ?? false;

  const [foldersRes, setsRes] = await Promise.all([
    supabase.from("folders").select("*").order("name", { ascending: true }),
    supabase.from("question_sets").select("*").order("created_at", { ascending: false }),
  ]);
  const folders = (foldersRes.data ?? []) as FolderRow[];
  const sets = (setsRes.data ?? []) as QuestionSetRow[];

  const summaries = new Map<string, FolderSummary>();
  const unfiled: FolderSummary = { setCount: 0, questionCount: 0 };
  for (const set of sets) {
    let target = unfiled;
    if (set.folder_id && folders.some((f) => f.id === set.folder_id)) {
      const existing = summaries.get(set.folder_id);
      if (existing) {
        target = existing;
      } else {
        target = { setCount: 0, questionCount: 0 };
        summaries.set(set.folder_id, target);
      }
    }
    target.setCount += 1;
    target.questionCount += set.question_count;
  }

  const totalQuestions = sets.reduce((sum, s) => sum + s.question_count, 0);
  const empty = folders.length === 0 && sets.length === 0;

  return (
    <>
      <PageHeader
        title="Library"
        description={
          isAdmin
            ? "The question bank every learner sees. Organise sets into subject folders."
            : "Browse the question bank by subject, open a folder, and practice any set."
        }
        actions={
          isAdmin ? (
            <>
              <CreateFolderButton />
              <ButtonLink href="/import">Import questions</ButtonLink>
            </>
          ) : (
            <ButtonLink href="/test/new">Build a test</ButtonLink>
          )
        }
      >
        {!empty && (
          <p className="mt-3 text-sm text-muted tabular-nums" data-testid="sets-summary">
            <span className="font-medium text-ink">{folders.length}</span>{" "}
            {plural(folders.length, "folder")}
            <span className="mx-1.5 text-faint">·</span>
            <span className="font-medium text-ink">{sets.length}</span>{" "}
            {plural(sets.length, "set")}
            <span className="mx-1.5 text-faint">·</span>
            <span className="font-medium text-ink">{totalQuestions}</span>{" "}
            {plural(totalQuestions, "question")}
          </p>
        )}
      </PageHeader>

      {empty ? (
        <EmptyState
          icon={Library}
          title={isAdmin ? "The library is empty" : "Nothing here yet"}
          body={
            isAdmin
              ? "Import your first JSON file and it becomes a set every learner can practice."
              : "The admin hasn't published any question sets yet. Check back soon."
          }
          action={
            isAdmin ? <ButtonLink href="/import">Import your first file</ButtonLink> : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              href={`/sets/folder/${folder.id}`}
              name={folder.name}
              tileClass={folderColorStyle(folder.color).tile}
              icon={folderIconComponent(folder.icon)}
              summary={summaries.get(folder.id) ?? { setCount: 0, questionCount: 0 }}
              testId="folder-card"
            />
          ))}
          {unfiled.setCount > 0 && (
            <FolderCard
              href="/sets/folder/unfiled"
              name="Unfiled"
              tileClass="bg-raised text-muted"
              icon={Library}
              summary={unfiled}
              testId="unfiled-card"
            />
          )}
        </div>
      )}
    </>
  );
}
