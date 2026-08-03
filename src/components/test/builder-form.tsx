"use client";

import {
  ArrowLeftRight,
  CircleDot,
  Clock3,
  Infinity as InfinityIcon,
  ListChecks,
  ListTodo,
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
import { TEST_LENGTH_PRESETS } from "@/lib/practice";
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

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; dot: string }[] = [
  { value: "easy", label: "Easy", dot: "bg-success" },
  { value: "medium", label: "Medium", dot: "bg-warn" },
  { value: "hard", label: "Hard", dot: "bg-danger" },
];

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised font-display text-sm text-muted">
        {step}
      </span>
      <Label className="font-display text-xl font-normal">{title}</Label>
      {hint && <span className="text-xs text-faint italic">{hint}</span>}
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
  const [timed, setTimed] = useState(false);
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

  // `count === 0` means "all that match".
  const effectiveCount = count === 0 ? available : Math.max(1, Math.min(count, available));
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
      durationMinutes: timed ? estimatedMinutes : null,
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
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Material scope">
            {(
              [
                { value: "all", label: "Whole library", icon: InfinityIcon },
                { value: "sets", label: "Pick sets", icon: ListTodo },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors",
                  mode === option.value
                    ? "border-accent-fill bg-accent-fill text-on-accent shadow-sm"
                    : "border-line-strong bg-raised/60 text-ink hover:bg-raised",
                )}
              >
                <option.icon className="size-4" aria-hidden />
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
          <div className="grid gap-3 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => {
              const checked = types.includes(option.value);
              const typeCount = perType[option.value];
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 text-sm transition-colors",
                    checked
                      ? "border-accent-fill bg-accent-soft/60"
                      : "border-line bg-raised/40 hover:bg-raised",
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
                  <span
                    className={cn(
                      "absolute top-3.5 right-3.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      checked ? "bg-accent-fill/10 text-accent-soft-ink" : "text-faint",
                    )}
                  >
                    {checked ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      checked ? "bg-surface text-accent" : "bg-surface text-muted",
                    )}
                  >
                    <option.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-ink tabular-nums">
                      {typeCount} available
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <StepHeading step={3} title="Difficulty" hint="mix and match" />
          <div className="flex flex-wrap gap-2.5">
            {DIFFICULTY_OPTIONS.map((option) => {
              const checked = difficulties.includes(option.value);
              const total = perDifficulty[option.value];
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                    checked
                      ? "border-accent-fill bg-accent-fill text-on-accent shadow-sm"
                      : "border-line bg-raised/60 text-muted hover:bg-raised hover:text-ink",
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
                  <span className={cn("size-2 rounded-full", option.dot)} aria-hidden />
                  {option.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                      checked ? "bg-white/20 text-on-accent" : "bg-surface text-muted",
                    )}
                  >
                    {total}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <StepHeading step={4} title="Length" hint="no upper limit" />
          <div className="flex flex-wrap gap-2.5" data-testid="count-options">
            {TEST_LENGTH_PRESETS.filter((option) => option <= available).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCount(option)}
                aria-pressed={count === option}
                className={cn(
                  "size-14 rounded-2xl border text-base font-medium transition-all",
                  count === option
                    ? "border-accent-fill bg-accent-fill text-on-accent shadow-md ring-2 ring-accent-fill/30 ring-offset-2 ring-offset-surface"
                    : "border-line-strong bg-raised/60 text-ink hover:bg-raised",
                )}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCount(0)}
              aria-pressed={count === 0}
              disabled={available === 0}
              className={cn(
                "h-14 rounded-2xl border px-5 text-base font-medium transition-all",
                count === 0
                  ? "border-accent-fill bg-accent-fill text-on-accent shadow-md ring-2 ring-accent-fill/30 ring-offset-2 ring-offset-surface"
                  : "border-line-strong bg-raised/60 text-ink hover:bg-raised",
                available === 0 && "pointer-events-none opacity-40",
              )}
            >
              All {available > 0 && <span className="tabular-nums">({available})</span>}
            </button>
          </div>
          {available > 0 && count > available && count !== 0 && (
            <p className="mt-2 text-xs text-muted" data-testid="count-all-note">
              Only {available} {plural(available, "question matches", "questions match")} — the
              test will use all {available}.
            </p>
          )}
        </Card>
      </div>

      {/* Phones get a fixed action bar so Start is always in reach; the full
          summary card below stays scrollable. It clears the tab bar. */}
      <div
        className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
              Your test
            </p>
            <p className="truncate text-sm text-ink tabular-nums">
              {available === 0 ? (
                "No questions match"
              ) : (
                <>
                  {effectiveCount} {plural(effectiveCount, "question")} · ≈ {estimatedMinutes} min
                </>
              )}
            </p>
          </div>
          <Button
            className="shrink-0"
            loading={starting}
            onClick={() => void onStart()}
            disabled={available === 0}
          >
            <Play className="size-4" aria-hidden /> Start
          </Button>
        </div>
      </div>

      <aside className="space-y-4 pb-24 lg:pb-0 lg:sticky lg:top-6">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-2xl text-ink">Your test</h2>
          <span className="mt-2 block h-1 w-10 rounded-full bg-accent-fill" aria-hidden />

          <div className="mt-5 flex items-end justify-between gap-3 border-b border-line pb-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              Questions
            </p>
            <p
              className="font-display text-5xl leading-none text-ink tabular-nums"
              data-testid="summary-count"
            >
              {available === 0 ? "—" : effectiveCount}
            </p>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
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
                  : types.map((t) => TYPE_OPTIONS.find((o) => o.value === t)?.label).join(", ") ||
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
                      .join(", ") || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-2xl bg-raised px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                <Clock3 className="size-3.5" aria-hidden /> Est. time
              </span>
              <span className="font-medium text-accent tabular-nums">
                {available === 0 ? "—" : `≈ ${estimatedMinutes} min`}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Estimate assumes about 45 seconds per question.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-line-strong/40 pt-3">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[#4f46e5]"
              />
              <span className="text-xs">
                <span className="font-medium text-ink">Timed exam mode</span>
                <span className="mt-0.5 block leading-relaxed text-muted">
                  A countdown, a question palette and no answers until you submit — like
                  the real thing.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4">
            <Label htmlFor="session-label" className="text-xs text-muted">
              Label (optional)
            </Label>
            <Input
              id="session-label"
              className="mt-1.5 h-10 rounded-full"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder="e.g. Night-before revision"
            />
          </div>

          <Button
            size="lg"
            className="mt-5 w-full"
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
