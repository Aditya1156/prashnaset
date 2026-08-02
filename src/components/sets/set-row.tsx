import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { MoveSetButton, type FolderOption } from "@/components/sets/folder-controls";
import { Badge } from "@/components/ui/badge";
import type { QuestionSetRow } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";

export function SetRow({ set, folders }: { set: QuestionSetRow; folders: FolderOption[] }) {
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
