import { ChevronRight, Folder, Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CreateFolderButton,
  FolderActions,
  MoveSetButton,
  type FolderOption,
} from "@/components/sets/folder-controls";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { FolderRow, QuestionSetRow } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Sets" };

function SetRow({ set, folders }: { set: QuestionSetRow; folders: FolderOption[] }) {
  return (
    <li className="flex items-center gap-1 rounded-2xl border border-line bg-surface pr-2 transition-colors hover:border-accent-fill/50">
      <Link
        href={`/sets/${set.id}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-4 sm:px-5"
      >
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-ink">{set.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">
              {set.question_count} {plural(set.question_count, "question")}
            </Badge>
            <Badge>{set.language === "hi" ? "Hindi" : "English"}</Badge>
            <span className="text-xs text-muted">Imported {formatDate(set.created_at)}</span>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
      </Link>
      <MoveSetButton
        setId={set.id}
        setTitle={set.title}
        currentFolderId={set.folder_id}
        folders={folders}
        compact
      />
    </li>
  );
}

export default async function SetsPage() {
  const supabase = await createClient();

  const [foldersRes, setsRes] = await Promise.all([
    supabase.from("folders").select("*").order("name", { ascending: true }),
    supabase.from("question_sets").select("*").order("created_at", { ascending: false }),
  ]);
  const folders = (foldersRes.data ?? []) as FolderRow[];
  const sets = (setsRes.data ?? []) as QuestionSetRow[];

  const folderOptions: FolderOption[] = folders.map((f) => ({ id: f.id, name: f.name }));
  const setsByFolder = new Map<string, QuestionSetRow[]>();
  const unfiled: QuestionSetRow[] = [];
  for (const set of sets) {
    if (set.folder_id && folders.some((f) => f.id === set.folder_id)) {
      const list = setsByFolder.get(set.folder_id) ?? [];
      list.push(set);
      setsByFolder.set(set.folder_id, list);
    } else {
      unfiled.push(set);
    }
  }

  const empty = folders.length === 0 && sets.length === 0;

  return (
    <>
      <PageHeader
        title="Your sets"
        description="One set per imported file. Group sets into folders, open one to inspect or edit its questions."
        actions={
          <>
            <CreateFolderButton />
            <ButtonLink href="/import">Import questions</ButtonLink>
          </>
        }
      />

      {empty ? (
        <EmptyState
          icon={Library}
          title="No sets yet"
          body="Import your first JSON file and it becomes a set here — ready to test in one click. Folders can wait until you have a few."
          action={<ButtonLink href="/import">Import your first file</ButtonLink>}
        />
      ) : (
        <div className="space-y-8" data-testid="sets-list">
          {folders.map((folder) => {
            const folderSets = setsByFolder.get(folder.id) ?? [];
            const questionTotal = folderSets.reduce((sum, s) => sum + s.question_count, 0);
            return (
              <section key={folder.id} data-testid="folder-section">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-ink">
                      <Folder className="size-4" aria-hidden />
                    </span>
                    <h2 className="truncate font-display text-xl text-ink">{folder.name}</h2>
                    <span className="shrink-0 text-xs text-muted">
                      {folderSets.length} {plural(folderSets.length, "set")}
                      {questionTotal > 0 && <> · {questionTotal} {plural(questionTotal, "question")}</>}
                    </span>
                  </div>
                  <FolderActions
                    folder={{ id: folder.id, name: folder.name }}
                    setCount={folderSets.length}
                  />
                </div>
                {folderSets.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-muted">
                    Nothing in here yet — move a set in, or pick this folder when importing.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {folderSets.map((set) => (
                      <SetRow key={set.id} set={set} folders={folderOptions} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {unfiled.length > 0 && (
            <section data-testid="unfiled-section">
              {folders.length > 0 && (
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-raised text-muted">
                    <Library className="size-4" aria-hidden />
                  </span>
                  <h2 className="font-display text-xl text-ink">Unfiled</h2>
                  <span className="text-xs text-muted">
                    {unfiled.length} {plural(unfiled.length, "set")}
                  </span>
                </div>
              )}
              <ul className="space-y-3">
                {unfiled.map((set) => (
                  <SetRow key={set.id} set={set} folders={folderOptions} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
