"use client";

import {
  ArrowLeftRight,
  ChevronRight,
  CircleDot,
  Clock3,
  Infinity as InfinityIcon,
  ListChecks,
  ListTodo,
  Play,
  Search,
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
import { BPSC_NEGATIVE_MARKING, BPSC_PRELIMS_MOCK, guessBreakEvenOptions } from "@/lib/scoring";
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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-fill font-display text-sm font-semibold text-on-accent">
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
  const [negative, setNegative] = useState(false);
  const [setSearch, setSetSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (validInitial.length > 0) {
      const folderIds = new Set<string>();
      for (const setId of validInitial) {
        const s = sets.find((x) => x.id === setId);
        folderIds.add(s?.folderId ?? "__unfiled");
      }
      return folderIds;
    }
    return new Set<string>();
  });
  // Set by the full-mock preset: the real paper allows 2 hours regardless of
  // what our per-question estimate would suggest. Cleared as soon as the
  // learner changes the length, so the figure shown is never a stale promise.
  const [durationOverride, setDurationOverride] = useState<number | null>(null);
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

  // `count === 0` means "all that match".
  const effectiveCount = count === 0 ? available : Math.max(1, Math.min(count, available));
  const estimatedMinutes =
    durationOverride ?? Math.max(1, Math.ceil(effectiveCount * MINUTES_PER_QUESTION));

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
      negativeMarking: negative ? BPSC_NEGATIVE_MARKING : 0,
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
            <div className="mt-4 space-y-3 border-t border-line pt-4" data-testid="set-choices">
              <label className="flex h-10 items-center gap-2.5 rounded-full border border-line-strong bg-background px-3.5 focus-within:border-accent-fill/50 focus-within:ring-2 focus-within:ring-accent-fill/40">
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

              {filteredGroups.length === 0 && setSearch.trim() && (
                <p className="py-4 text-center text-sm text-muted">
                  No sets match &ldquo;{setSearch.trim()}&rdquo;
                </p>
              )}

              {filteredGroups.map((group) => {
                const folderId = group.folder?.id ?? "__unfiled";
                const isExpanded = expandedFolders.has(folderId) || setSearch.trim() !== "";
                const ids = group.sets.map((s) => s.id);
                const selectedCount = ids.filter((id) => selected.includes(id)).length;
                const allSelected = selectedCount === ids.length && ids.length > 0;
                const style = group.folder ? folderColorStyle(group.folder.color) : null;
                const GroupIcon = group.folder
                  ? (FOLDER_ICONS[group.folder.icon as FolderIcon] ?? FOLDER_ICONS.folder)
                  : FOLDER_ICONS.folder;
                const folderTotal = ids.reduce((sum, id) => sum + (setTotals.get(id) ?? 0), 0);
                return (
                  <div key={folderId} className="rounded-2xl border border-line shadow-sm overflow-hidden">
                    <div
                      className={cn(
                        "flex items-center gap-0.5",
                        isExpanded && "border-b border-line bg-raised/30",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFolder(folderId)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-raised/60"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 shrink-0 text-muted transition-transform",
                            isExpanded && "rotate-90",
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg",
                            style ? style.tile : "bg-raised text-muted",
                          )}
                        >
                          <GroupIcon className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {group.folder?.name ?? "Unfiled"}
                          </span>
                          <span className="block text-xs text-muted tabular-nums">
                            {ids.length} {plural(ids.length, "set")} · {folderTotal}{" "}
                            {plural(folderTotal, "question")}
                          </span>
                        </span>
                        {selectedCount > 0 && !allSelected && (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-ink tabular-nums">
                            {selectedCount}/{ids.length}
                          </span>
                        )}
                      </button>
                      <label
                        className="flex shrink-0 cursor-pointer items-center gap-1.5 px-3.5 py-3"
                        title={allSelected ? "Deselect all sets in this folder" : "Select all sets in this folder"}
                      >
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleGroup(group.sets, e.target.checked)}
                          className="size-4 accent-[var(--accent)]"
                        />
                      </label>
                    </div>

                    {isExpanded && (
                      <div className="space-y-1.5 px-3 pb-3 pt-2">
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
                                  className="size-4 shrink-0 accent-[var(--accent)]"
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
                    )}
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
                      checked ? "bg-accent-fill text-on-accent" : "text-faint",
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
                onClick={() => {
                  setCount(option);
                  setDurationOverride(null);
                }}
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
              onClick={() => {
                setCount(0);
                setDurationOverride(null);
              }}
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
          {available >= BPSC_PRELIMS_MOCK.questions && (
            <button
              type="button"
              onClick={() => {
                setCount(BPSC_PRELIMS_MOCK.questions);
                setTimed(true);
                setNegative(true);
                setMode("all");
                setDurationOverride(BPSC_PRELIMS_MOCK.minutes);
              }}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-navy/30 border-l-4 border-l-accent-fill bg-navy px-4 py-3 text-left text-on-navy transition-colors hover:bg-navy-raised"
              data-testid="mock-preset"
            >
              <span>
                <span className="block text-sm font-medium">Full BPSC prelims mock</span>
                <span className="mt-0.5 block text-xs text-on-navy-muted">
                  {BPSC_PRELIMS_MOCK.questions} questions · {BPSC_PRELIMS_MOCK.minutes} min ·
                  negative marking
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-navy-raised px-3 py-1 text-xs font-medium">
                Set up
              </span>
            </button>
          )}
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
        className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-navy/95 text-on-navy px-4 py-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-on-navy-muted uppercase">
              Your test
            </p>
            <p className="truncate text-sm text-on-navy tabular-nums">
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
              className={cn("font-display text-5xl leading-none tabular-nums", available > 0 ? "text-accent" : "text-ink")}
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
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="text-xs">
                <span className="font-medium text-ink">Timed exam mode</span>
                <span className="mt-0.5 block leading-relaxed text-muted">
                  A countdown, a question palette and no answers until you submit — like
                  the real thing.
                </span>
              </span>
            </label>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={negative}
                onChange={(e) => setNegative(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                data-testid="negative-marking-toggle"
              />
              <span className="text-xs">
                <span className="font-medium text-ink">Negative marking (BPSC 1/3)</span>
                <span className="mt-0.5 block leading-relaxed text-muted">
                  A wrong answer costs a third of a mark; skipping costs nothing. A blind
                  guess only pays from {guessBreakEvenOptions(BPSC_NEGATIVE_MARKING)} options
                  down.
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
