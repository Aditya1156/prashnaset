import { Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { createElement } from "react";
import { LibraryBrowser, type LibraryFolderCard } from "@/components/library/library-browser";
import { CreateFolderButton } from "@/components/sets/folder-controls";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { folderColorStyle, folderIconComponent } from "@/lib/folder-style";
import { createClient } from "@/lib/supabase/server";
import type { FolderRow, QuestionSetRow } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Library" };

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

  const summary = new Map<string, { setCount: number; questionCount: number }>();
  const unfiled = { setCount: 0, questionCount: 0 };
  for (const set of sets) {
    let target = unfiled;
    if (set.folder_id && folders.some((f) => f.id === set.folder_id)) {
      const existing = summary.get(set.folder_id);
      if (existing) {
        target = existing;
      } else {
        target = { setCount: 0, questionCount: 0 };
        summary.set(set.folder_id, target);
      }
    }
    target.setCount += 1;
    target.questionCount += set.question_count;
  }

  const folderCards: LibraryFolderCard[] = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    description: folder.description,
    setCount: summary.get(folder.id)?.setCount ?? 0,
    questionCount: summary.get(folder.id)?.questionCount ?? 0,
  }));

  const totalQuestions = sets.reduce((sum, s) => sum + s.question_count, 0);
  const recentSets = sets.slice(0, 4);
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));
  const empty = folders.length === 0 && sets.length === 0;

  return (
    <>
      <PageHeader
        overline="Academic repository"
        title="Library"
        description={
          isAdmin
            ? "The centralised question bank every learner sees. Organise sets into subject folders."
            : "The question bank, organised by subject. Open a folder and practice any set."
        }
        actions={
          isAdmin ? (
            <>
              <CreateFolderButton />
              <ButtonLink href="/import" variant="navy">
                Import questions
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/test/new">Build a test</ButtonLink>
          )
        }
      />

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
        <>
          <LibraryBrowser
            folders={folderCards}
            unfiled={unfiled}
            totals={{ folders: folders.length, sets: sets.length, questions: totalQuestions }}
            isAdmin={isAdmin}
          />

          {recentSets.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">Recently added</h2>
              </div>
              <div className="space-y-2.5">
                {recentSets.map((set) => {
                  const folder = set.folder_id
                    ? (folderNameById.get(set.folder_id) ?? null)
                    : null;
                  const folderRow = folders.find((f) => f.id === set.folder_id);
                  return (
                    <Link
                      key={set.id}
                      href={`/sets/${set.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent-fill/50 sm:px-5"
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          folderRow
                            ? folderColorStyle(folderRow.color).tile
                            : "bg-raised text-muted",
                        )}
                      >
                        {createElement(
                          folderRow ? folderIconComponent(folderRow.icon) : Library,
                          { className: "size-4.5", "aria-hidden": true },
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {set.title}
                        </span>
                        <span className="text-xs text-muted">
                          In <span className="font-medium text-ink">{folder ?? "Unfiled"}</span> ·{" "}
                          {formatDate(set.created_at)}
                        </span>
                      </span>
                      <Badge tone="accent" className="shrink-0 tabular-nums">
                        {set.question_count} qs
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
