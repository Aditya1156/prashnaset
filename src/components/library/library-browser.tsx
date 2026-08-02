"use client";

import { FileQuestion, Layers, Library, Search } from "lucide-react";
import Link from "next/link";
import { createElement, useMemo, useState } from "react";
import { CreateFolderButton } from "@/components/sets/folder-controls";
import { Card } from "@/components/ui/card";
import { folderColorStyle, folderIconComponent } from "@/lib/folder-style";
import { cn, plural } from "@/lib/utils";

export interface LibraryFolderCard {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  setCount: number;
  questionCount: number;
}

interface LibraryBrowserProps {
  folders: LibraryFolderCard[];
  unfiled: { setCount: number; questionCount: number };
  totals: { folders: number; sets: number; questions: number };
  isAdmin: boolean;
}

function FolderTile({
  folder,
  isUnfiled = false,
}: {
  folder: LibraryFolderCard;
  isUnfiled?: boolean;
}) {
  const style = isUnfiled ? null : folderColorStyle(folder.color);
  const icon = isUnfiled ? Library : folderIconComponent(folder.icon);
  const empty = folder.questionCount === 0;

  return (
    <Link
      href={isUnfiled ? "/sets/folder/unfiled" : `/sets/folder/${folder.id}`}
      data-testid={isUnfiled ? "unfiled-card" : "folder-card"}
      className="group block h-full"
    >
      <Card className="flex h-full min-h-56 flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-lg sm:p-6">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl",
            style ? style.tile : "bg-raised text-muted",
          )}
        >
          {createElement(icon, { className: "size-6", "aria-hidden": true })}
        </span>
        <h2 className="mt-4 font-display text-xl text-ink">{folder.name}</h2>
        <p
          className={cn(
            "mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed",
            empty && !folder.description ? "text-faint italic" : "text-muted",
          )}
        >
          {folder.description ??
            (empty
              ? isUnfiled
                ? "Sets without a folder land here."
                : "No questions yet — import into this folder to fill it."
              : isUnfiled
                ? "Sets without a folder land here."
                : `${folder.questionCount} ${plural(folder.questionCount, "question")} across ${folder.setCount} ${plural(folder.setCount, "set")}.`)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-muted tabular-nums">
            <Layers className="size-3.5" aria-hidden />
            {folder.setCount} {plural(folder.setCount, "set")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-muted tabular-nums">
            <FileQuestion className="size-3.5" aria-hidden />
            {folder.questionCount} {plural(folder.questionCount, "question")}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export function LibraryBrowser({ folders, unfiled, totals, isAdmin }: LibraryBrowserProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return folders;
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(needle) ||
        (folder.description ?? "").toLowerCase().includes(needle),
    );
  }, [folders, query]);

  const showUnfiled =
    unfiled.setCount > 0 &&
    (query.trim() === "" || "unfiled".includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-full border border-line-strong bg-background px-4 focus-within:border-accent-fill/50 focus-within:ring-2 focus-within:ring-accent-fill/40">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search folders and topics…"
            aria-label="Search folders"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        <div
          className="flex shrink-0 items-center gap-6 px-1 tabular-nums"
          data-testid="sets-summary"
        >
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
              Total folders
            </p>
            <p className="mt-0.5 font-display text-xl text-ink">{totals.folders}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
              Total sets
            </p>
            <p className="mt-0.5 font-display text-xl text-ink">{totals.sets}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
              Total questions
            </p>
            <p className="mt-0.5 font-display text-xl text-ink">{totals.questions}</p>
          </div>
        </div>
      </Card>

      {visible.length === 0 && !showUnfiled ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">
          No folders match “{query.trim()}”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((folder) => (
            <FolderTile key={folder.id} folder={folder} />
          ))}
          {showUnfiled && (
            <FolderTile
              isUnfiled
              folder={{
                id: "unfiled",
                name: "Unfiled",
                color: "slate",
                icon: "folder",
                description: null,
                setCount: unfiled.setCount,
                questionCount: unfiled.questionCount,
              }}
            />
          )}
          {isAdmin && query.trim() === "" && <CreateFolderButton asCard />}
        </div>
      )}
    </div>
  );
}
