"use client";

import {
  ArrowLeftRight,
  CircleDot,
  Clock3,
  ListChecks,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createTestSession } from "@/lib/actions/sessions";
import { FOLDER_ICONS, folderColorStyle, type FolderIcon } from "@/lib/folder-style";
import type { Difficulty, QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface BuilderSet {
  id: string;
  title: string;
  folderId: string | null;
}

export interface BuilderFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface QuestionTally {
  setId: string;
  type: QuestionType;
  difficulty: Difficulty;
  count: number;
}

const COUNT_OPTIONS = [5, 10, 15, 20, 25];
const MINUTES_PER_QUESTION = 0.75;

const TYPE_OPTIONS: {
  value: QuestionType;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { value: "mcq", label: "MCQ", hint: "one correct option", icon: CircleDot },
  { value: "msq", label: "MSQ", hint: "select all that apply", icon: ListChecks },
  { value: "match", label: "Match", hint: "pair the columns", icon: ArrowLeftRight },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs text-accent-soft-ink">
        {step}
      </span>
      <Label className="text-base">{title}</Label>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function BuilderForm({
  sets,
  folders,
  tallies,
  initialSetIds,
}: {
  sets: BuilderSet[];
  folders: BuilderFolder[];
  tallies: QuestionTally[];
  initialSetIds: string[];
}) {
  const validInitial = initialSetIds.filter((id) => sets.some((s) => s.id === id));
  const [mode, setMode] = useState<"all" | "sets">(validInitial.length > 0 ? "sets" : "all");
  const [selected, setSelected] = useState<string[]>(validInitial);
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "msq", "match"]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(["easy", "medium", "hard"]);
  const [count, setCount] = useState(10);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const inScope = useMemo(() => {
    const scoped = new Set(mode === "all" ? sets.map((s) => s.id) : selected);
    return tallies.filter((t) => scoped.has(t.setId));
  }, [mode, selected, sets, tallies]);

  const available = useMemo(
    () =>
      inScope
        .filter((t) => types.includes(t.type) && difficulties.includes(t.difficulty))
        .reduce((sum, t) => sum + t.count, 0),
    [inScope, types, difficulties],
  );

  const perType = useMemo(() => {
    const totals: Record<QuestionType, number> = { mcq: 0, msq: 0, match: 0 };
    for (const t of inScope) {
      if (difficulties.includes(t.difficulty)) totals[t.type] += t.count;
    }
    return totals;
  }, [inScope, difficulties]);

  const perDifficulty = useMemo(() => {
    const totals: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const t of inScope) {
      if (types.includes(t.type)) totals[t.difficulty] += t.count;
    }
    return totals;
  }, [inScope, types]);

  const setTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of tallies) totals.set(t.setId, (totals.get(t.setId) ?? 0) + t.count);
    return totals;
  }, [tallies]);

  const groups = useMemo(() => {
    const byFolder = new Map<string | null, BuilderSet[]>();
    for (const set of sets) {
      const key = set.folderId && folders.some((f) => f.id === set.folderId) ? set.folderId : null;
      const list = byFolder.get(key) ?? [];
      list.push(set);
      byFolder.set(key, list);
    }
    const ordered: { folder: BuilderFolder | null; sets: BuilderSet[] }[] = [];
    for (const folder of folders) {
      const folderSets = byFolder.get(folder.id);
      if (folderSets && folderSets.length > 0) ordered.push({ folder, sets: folderSets });
    }
    const unfiled = byFolder.get(null);
    if (unfiled && unfiled.length > 0) ordered.push({ folder: null, sets: unfiled });
    return ordered;
  }, [sets, folders]);

  const smallestOption = COUNT_OPTIONS[0];
  const effectiveCount = Math.max(1, Math.min(count, available));
  const estimatedMinutes = Math.max(1, Math.ceil(effectiveCount * MINUTES_PER_QUESTION));

  function toggleSet(id: string, on: boolean) {
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function toggleGroup(groupSets: BuilderSet[], on: boolean) {
    setSelected((prev) => {
      const ids = groupSets.map((s) => s.id);
      const without = prev.filter((x) => !ids.includes(x));
      return on ? [...without, ...ids] : without;
    });
  }

  async function onStart() {
    setError(null);
    if (types.length === 0) {
      setError("Pick at least one question type.");
      return;
    }
    if (difficulties.length === 0) {
      setError("Pick at least one difficulty.");
      return;
    }
    if (mode === "sets" && selected.length === 0) {
      setError("Choose at least one set.");
      return;
    }
    if (available === 0) {
      setError("No questions match those filters.");
      return;
    }

    setStarting(true);
    const result = await createTestSession({
      scope: mode,
      setIds: mode === "sets" ? selected : [],
      types,
      difficulties,
      count: effectiveCount,
      label: label.trim() || undefined,
    });
    // On success the action redirects into the runner and never returns.
    setStarting(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <Card className="p-5">
          <StepHeading step={1} title="Material" />
          <div className="flex gap-2" role="radiogroup" aria-label="Material scope">
            {(
              [
                { value: "all", label: "Whole library" },
                { value: "sets", label: "Pick sets" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
                  mode === option.value
                    ? "border-accent-fill bg-accent-fill text-on-accent"
                    : "border-line-strong text-ink hover:bg-raised",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "sets" && (
            <div className="mt-4 space-y-4 border-t border-line pt-4" data-testid="set-choices">
              {groups.map((group) => {
                const ids = group.sets.map((s) => s.id);
                const selectedCount = ids.filter((id) => selected.includes(id)).length;
                const allSelected = selectedCount === ids.length;
                const style = group.folder ? folderColorStyle(group.folder.color) : null;
                const GroupIcon = group.folder
                  ? (FOLDER_ICONS[group.folder.icon as FolderIcon] ?? FOLDER_ICONS.folder)
                  : FOLDER_ICONS.folder;
                return (
                  <div key={group.folder?.id ?? "unfiled"}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
                            style ? style.tile : "bg-raised text-muted",
                          )}
                        >
                          <GroupIcon className="size-3.5" aria-hidden />
                        </span>
                        <span className="truncate text-sm font-medium text-ink">
                          {group.folder?.name ?? "Unfiled"}
                        </span>
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {selectedCount}/{ids.length}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.sets, !allSelected)}
                        className="shrink-0 text-xs font-medium text-accent underline-offset-4 hover:underline"
                      >
                        {allSelected ? "Clear" : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {group.sets.map((set) => {
                        const checked = selected.includes(set.id);
                        const total = setTotals.get(set.id) ?? 0;
                        return (
                          <label
                            key={set.id}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                              checked
                                ? "border-accent-fill/60 bg-accent-soft"
                                : "border-line hover:bg-raised",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleSet(set.id, e.target.checked)}
                                className="size-4 shrink-0 accent-[#4f46e5]"
                              />
                              <span className="truncate font-medium text-ink">{set.title}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted tabular-nums">
                              {total} {plural(total, "question")}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <StepHeading step={2} title="Question types" />
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => {
              const checked = types.includes(option.value);
              const typeCount = perType[option.value];
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3 text-sm transition-colors",
                    checked ? "border-accent-fill/60 bg-accent-soft" : "border-line hover:bg-raised",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setTypes((prev) =>
                        e.target.checked
                          ? [...prev, option.value]
                          : prev.filter((t) => t !== option.value),
                      )
                    }
                    className="sr-only"
                  />
                  <option.icon
                    className={cn("mt-0.5 size-4 shrink-0", checked ? "text-accent" : "text-muted")}
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-ink">{option.label}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {option.hint} · {typeCount} available
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <StepHeading step={3} title="Difficulty" hint="mix and match" />
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_OPTIONS.map((option) => {
              const checked = difficulties.includes(option.value);
              const total = perDifficulty[option.value];
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                    checked
                      ? "border-accent-fill/60 bg-accent-soft text-ink"
                      : "border-line text-muted hover:bg-raised",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setDifficulties((prev) =>
                        e.target.checked
                          ? [...prev, option.value]
                          : prev.filter((d) => d !== option.value),
                      )
                    }
                    className="sr-only"
                  />
                  {option.label}
                  <span className="text-xs text-muted tabular-nums">{total}</span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <StepHeading step={4} title="Length" />
          {available >= smallestOption ? (
            <div className="flex flex-wrap gap-2" data-testid="count-options">
              {COUNT_OPTIONS.map((option) => {
                const disabled = option > available;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCount(option)}
                    aria-pressed={count === option}
                    className={cn(
                      "h-10 w-14 rounded-lg border text-sm font-medium transition-colors",
                      count === option
                        ? "border-accent-fill bg-accent-fill text-on-accent"
                        : "border-line-strong text-ink hover:bg-raised",
                      disabled && "pointer-events-none opacity-40",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink" data-testid="count-all-note">
              Only <span className="font-semibold">{available}</span>{" "}
              {plural(available, "question matches", "questions match")} — the test will use all{" "}
              {available}.
            </p>
          )}
          {available >= smallestOption && count > available && (
            <p className="mt-2 text-xs text-muted">
              Only {available} available — the test will use all {available}.
            </p>
          )}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Your test</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Questions</dt>
              <dd
                className="font-display text-2xl text-ink tabular-nums"
                data-testid="summary-count"
              >
                {available === 0 ? "—" : effectiveCount}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">From</dt>
              <dd className="text-right font-medium text-ink">
                {mode === "all"
                  ? "Whole library"
                  : `${selected.length} ${plural(selected.length, "set")}`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Types</dt>
              <dd className="text-right font-medium text-ink">
                {types.length === 3
                  ? "All three"
                  : types.map((t) => TYPE_OPTIONS.find((o) => o.value === t)?.label).join(" + ") ||
                    "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Difficulty</dt>
              <dd className="text-right font-medium text-ink">
                {difficulties.length === 3
                  ? "Mixed"
                  : difficulties
                      .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                      .join(" + ") || "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt className="flex items-center gap-1.5 text-muted">
                <Clock3 className="size-3.5" aria-hidden /> Est. time
              </dt>
              <dd className="font-medium text-ink tabular-nums">
                {available === 0 ? "—" : `≈ ${estimatedMinutes} min`}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Estimate assumes about 45 seconds per question.
          </p>

          <div className="mt-4 border-t border-line pt-4">
            <Label htmlFor="session-label" className="text-xs text-muted">
              Label (optional)
            </Label>
            <Input
              id="session-label"
              className="mt-1.5 h-9"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder="e.g. Night-before revision"
            />
          </div>

          <Button
            size="lg"
            className="mt-4 w-full"
            loading={starting}
            onClick={() => void onStart()}
            disabled={available === 0}
          >
            <Play className="size-4" aria-hidden />
            Start test{available > 0 && ` · ${effectiveCount} ${plural(effectiveCount, "question")}`}
          </Button>
          {available === 0 && (
            <p className="mt-2 text-center text-xs text-danger">
              No questions match those filters.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
