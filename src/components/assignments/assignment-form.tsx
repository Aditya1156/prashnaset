"use client";

import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createAssignment } from "@/lib/actions/assignments";
import { FOLDER_ICONS, folderColorStyle, type FolderIcon } from "@/lib/folder-style";
import type { Difficulty, QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface AssignableSet {
  id: string;
  title: string;
  questionCount: number;
  folderId: string | null;
}

export interface AssignableFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface AssignableLearner {
  id: string;
  name: string;
  email: string;
}

export interface AssignableBatch {
  id: string;
  name: string;
  learnerCount: number;
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "MCQ" },
  { value: "msq", label: "MSQ" },
  { value: "match", label: "Match" },
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COUNTS = [5, 10, 15, 20, 25];

type AssignMode = "all" | "batch" | "learners";

export function CreateAssignmentButton({
  sets,
  folders,
  learners,
  batches,
}: {
  sets: AssignableSet[];
  folders: AssignableFolder[];
  learners: AssignableLearner[];
  batches: AssignableBatch[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [setIds, setSetIds] = useState<string[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "msq", "match"]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(["easy", "medium", "hard"]);
  const [count, setCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState<number | "">(15);
  const [dueAt, setDueAt] = useState("");
  const [assignMode, setAssignMode] = useState<AssignMode>("all");
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [setSearch, setSetSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byFolder = new Map<string | null, AssignableSet[]>();
    for (const set of sets) {
      const key = set.folderId && folders.some((f) => f.id === set.folderId) ? set.folderId : null;
      const list = byFolder.get(key) ?? [];
      list.push(set);
      byFolder.set(key, list);
    }
    const ordered: { folder: AssignableFolder | null; sets: AssignableSet[] }[] = [];
    for (const folder of folders) {
      const folderSets = byFolder.get(folder.id);
      if (folderSets && folderSets.length > 0) ordered.push({ folder, sets: folderSets });
    }
    const unfiled = byFolder.get(null);
    if (unfiled && unfiled.length > 0) ordered.push({ folder: null, sets: unfiled });
    return ordered;
  }, [sets, folders]);

  const filteredGroups = useMemo(() => {
    const needle = setSearch.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        sets: group.sets.filter((s) => s.title.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.sets.length > 0);
  }, [groups, setSearch]);

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function toggleGroup(groupSets: AssignableSet[], on: boolean) {
    setSetIds((prev) => {
      const ids = groupSets.map((s) => s.id);
      const without = prev.filter((x) => !ids.includes(x));
      return on ? [...without, ...ids] : without;
    });
  }

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createAssignment({
      title: title.trim(),
      instructions: instructions.trim(),
      setIds,
      types,
      difficulties,
      count,
      durationMinutes: durationMinutes === "" ? null : Number(durationMinutes),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assignAll: assignMode === "all",
      batchId: assignMode === "batch" ? batchId : null,
      userIds: assignMode === "learners" ? userIds : [],
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the assignment.");
      return;
    }
    setOpen(false);
    setTitle("");
    setInstructions("");
    setSetIds([]);
    setUserIds([]);
    router.refresh();
  }

  return (
    <>
      <Button variant="navy" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> New assignment
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Assign a test" wide>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Title" htmlFor="assignment-title">
            <Input
              id="assignment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Weekly test 1 — Ancient History"
              autoFocus
            />
          </Field>

          <Field label="Instructions (optional)" htmlFor="assignment-instructions">
            <Textarea
              id="assignment-instructions"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={1000}
              placeholder="Anything learners should know before starting."
            />
          </Field>

          <div className="space-y-1.5">
            <Label>
              Sets <span className="font-normal text-muted">— leave empty for the whole library</span>
            </Label>

            {groups.length > 0 && (
              <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-background px-3 focus-within:border-accent-fill/50 focus-within:ring-2 focus-within:ring-accent-fill/40">
                <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
                <input
                  type="search"
                  value={setSearch}
                  onChange={(e) => setSetSearch(e.target.value)}
                  placeholder="Search sets…"
                  aria-label="Search sets"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                />
              </label>
            )}

            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {sets.length === 0 ? (
                <p className="rounded-xl border border-line px-3 py-4 text-center text-sm text-muted">
                  No sets with questions yet.
                </p>
              ) : filteredGroups.length === 0 && setSearch.trim() ? (
                <p className="rounded-xl border border-line px-3 py-4 text-center text-sm text-muted">
                  No sets match &ldquo;{setSearch.trim()}&rdquo;
                </p>
              ) : (
                filteredGroups.map((group) => {
                  const folderId = group.folder?.id ?? "__unfiled";
                  const isExpanded = expandedFolders.has(folderId) || setSearch.trim() !== "";
                  const ids = group.sets.map((s) => s.id);
                  const selectedCount = ids.filter((id) => setIds.includes(id)).length;
                  const allSelected = selectedCount === ids.length && ids.length > 0;
                  const style = group.folder ? folderColorStyle(group.folder.color) : null;
                  const GroupIcon = group.folder
                    ? (FOLDER_ICONS[group.folder.icon as FolderIcon] ?? FOLDER_ICONS.folder)
                    : FOLDER_ICONS.folder;
                  const folderTotal = ids.reduce(
                    (sum, id) => sum + (sets.find((s) => s.id === id)?.questionCount ?? 0),
                    0,
                  );

                  return (
                    <div key={folderId} className="overflow-hidden rounded-xl border border-line">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleFolder(folderId)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-raised/60"
                        >
                          <ChevronRight
                            className={cn(
                              "size-3.5 shrink-0 text-muted transition-transform",
                              isExpanded && "rotate-90",
                            )}
                            aria-hidden
                          />
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-md",
                              style ? style.tile : "bg-raised text-muted",
                            )}
                          >
                            <GroupIcon className="size-3" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {group.folder?.name ?? "Unfiled"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted tabular-nums">
                            {folderTotal} qs
                          </span>
                        </button>
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-accent">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleGroup(group.sets, e.target.checked)}
                            className="size-4 accent-[#4f46e5]"
                          />
                          {selectedCount > 0 && !allSelected
                            ? `${selectedCount}/${ids.length}`
                            : ""}
                        </label>
                      </div>

                      {isExpanded && (
                        <div className="space-y-1 border-t border-line px-2.5 pb-2.5 pt-2">
                          {group.sets.map((set) => {
                            const checked = setIds.includes(set.id);
                            return (
                              <label
                                key={set.id}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm",
                                  checked
                                    ? "border-accent-fill/60 bg-accent-soft"
                                    : "border-transparent hover:bg-raised",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setSetIds((prev) =>
                                        e.target.checked
                                          ? [...prev, set.id]
                                          : prev.filter((id) => id !== set.id),
                                      )
                                    }
                                    className="size-4 shrink-0 accent-[#4f46e5]"
                                  />
                                  <span className="truncate text-ink">{set.title}</span>
                                </span>
                                <span className="shrink-0 text-xs text-muted tabular-nums">
                                  {set.questionCount}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {setIds.length > 0 && (
              <p className="text-xs text-muted">
                {setIds.length} {plural(setIds.length, "set")} selected
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Question types</Label>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((type) => {
                  const checked = types.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      type="button"
                      aria-pressed={checked}
                      onClick={() =>
                        setTypes((prev) =>
                          checked ? prev.filter((t) => t !== type.value) : [...prev, type.value],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        checked
                          ? "border-accent-fill bg-accent-fill text-on-accent"
                          : "border-line-strong text-muted",
                      )}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div className="flex flex-wrap gap-1.5">
                {DIFFICULTIES.map((level) => {
                  const checked = difficulties.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={checked}
                      onClick={() =>
                        setDifficulties((prev) =>
                          checked ? prev.filter((d) => d !== level) : [...prev, level],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                        checked
                          ? "border-accent-fill bg-accent-fill text-on-accent"
                          : "border-line-strong text-muted",
                      )}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Questions" htmlFor="assignment-count">
              <Select
                id="assignment-count"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {COUNTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time limit (min)" htmlFor="assignment-duration">
              <Input
                id="assignment-duration"
                type="number"
                min={1}
                max={300}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Untimed"
              />
            </Field>
            <Field label="Due (optional)" htmlFor="assignment-due">
              <Input
                id="assignment-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <Label>Who gets it</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "all" as AssignMode, label: "Everyone" },
                  ...(batches.length > 0
                    ? [{ value: "batch" as AssignMode, label: "A batch" }]
                    : []),
                  { value: "learners" as AssignMode, label: "Chosen learners" },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={assignMode === option.value}
                  onClick={() => setAssignMode(option.value)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium",
                    assignMode === option.value
                      ? "border-navy bg-navy text-on-navy"
                      : "border-line-strong text-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {assignMode === "batch" && (
              <div className="mt-2 space-y-1.5">
                {batches.map((batch) => (
                  <label
                    key={batch.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      batchId === batch.id
                        ? "border-navy/60 bg-navy/5"
                        : "border-line hover:bg-raised",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="batch"
                        checked={batchId === batch.id}
                        onChange={() => setBatchId(batch.id)}
                        className="size-4 accent-[#4f46e5]"
                      />
                      <span className="font-medium text-ink">{batch.name}</span>
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {batch.learnerCount} {plural(batch.learnerCount, "learner")}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {assignMode === "learners" && (
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
                {learners.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted">No learners have signed up yet.</p>
                ) : (
                  learners.map((learner) => {
                    const checked = userIds.includes(learner.id);
                    return (
                      <label
                        key={learner.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-raised"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setUserIds((prev) =>
                              e.target.checked
                                ? [...prev, learner.id]
                                : prev.filter((id) => id !== learner.id),
                            )
                          }
                          className="size-4 shrink-0 accent-[#4f46e5]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{learner.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {learner.email}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
            {assignMode === "learners" && userIds.length > 0 && (
              <p className="text-xs text-muted">
                {userIds.length} {plural(userIds.length, "learner")} selected
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onCreate()}
            loading={saving}
            disabled={!title.trim() || types.length === 0 || difficulties.length === 0}
          >
            <ClipboardList className="size-4" aria-hidden /> Assign test
          </Button>
        </div>
      </Modal>
    </>
  );
}
