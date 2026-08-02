import { ArrowLeft, FolderOpen, Library, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { FolderPageControls, type FolderOption } from "@/components/sets/folder-controls";
import { SetRow } from "@/components/sets/set-row";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { folderColorStyle, folderIconComponent } from "@/lib/folder-style";
import { createClient } from "@/lib/supabase/server";
import type { FolderRow, QuestionSetRow } from "@/lib/types";
import { cn, formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Folder" };

export default async function FolderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isUnfiled = id === "unfiled";
  const supabase = await createClient();

  const { data: folderData } = await supabase
    .from("folders")
    .select("*")
    .order("name", { ascending: true });
  const folders = (folderData ?? []) as FolderRow[];

  let folder: FolderRow | null = null;
  if (!isUnfiled) {
    folder = folders.find((f) => f.id === id) ?? null;
    if (!folder) notFound();
  }

  let setsQuery = supabase
    .from("question_sets")
    .select("*")
    .order("created_at", { ascending: false });
  setsQuery = isUnfiled ? setsQuery.is("folder_id", null) : setsQuery.eq("folder_id", id);
  const { data: setsData } = await setsQuery;
  const sets = (setsData ?? []) as QuestionSetRow[];

  const questionTotal = sets.reduce((sum, s) => sum + s.question_count, 0);
  const folderOptions: FolderOption[] = folders.map((f) => ({ id: f.id, name: f.name }));
  const headerIcon = folder ? folderIconComponent(folder.icon) : Library;
  const tileClass = folder ? folderColorStyle(folder.color).tile : "bg-raised text-muted";
  const testHref =
    sets.length > 0
      ? `/test/new?${sets.map((s) => `set=${s.id}`).join("&")}`
      : null;

  return (
    <>
      <Link
        href="/sets"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> All folders
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-2xl",
              tileClass,
            )}
          >
            {createElement(headerIcon, { className: "size-6", "aria-hidden": true })}
          </span>
          <div className="min-w-0">
            <h1
              className="truncate font-display text-2xl tracking-tight text-ink sm:text-3xl"
              data-testid="folder-title"
            >
              {folder ? folder.name : "Unfiled"}
            </h1>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {sets.length} {plural(sets.length, "set")} · {questionTotal}{" "}
              {plural(questionTotal, "question")}
              {folder && <> · created {formatDate(folder.created_at)}</>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {questionTotal > 0 && testHref && (
            <ButtonLink href={testHref}>
              <Play className="size-4" aria-hidden /> Test this folder
            </ButtonLink>
          )}
          {folder && <FolderPageControls folder={folder} setCount={sets.length} />}
        </div>
      </div>

      {sets.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={isUnfiled ? "Nothing unfiled" : "This folder is empty"}
          body={
            isUnfiled
              ? "Every set is filed into a folder. New imports land here when you don't pick a folder."
              : "Move sets in from their pages, or pick this folder when importing a new file."
          }
          action={<ButtonLink href="/import">Import questions</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3" data-testid="sets-list">
          {sets.map((set) => (
            <SetRow key={set.id} set={set} folders={folderOptions} />
          ))}
        </ul>
      )}
    </>
  );
}
