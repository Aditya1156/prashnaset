"use client";

import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { createTestSession } from "@/lib/actions/sessions";
import type { QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface BuilderSet {
  id: string;
  title: string;
  counts: Record<QuestionType, number>;
}

const COUNT_OPTIONS = [5, 10, 15, 20, 25];
const TYPE_OPTIONS: { value: QuestionType; label: string; hint: string }[] = [
  { value: "mcq", label: "MCQ", hint: "one correct option" },
  { value: "msq", label: "MSQ", hint: "select all that apply" },
  { value: "match", label: "Match", hint: "pair the columns" },
];

export function BuilderForm({
  sets,
  initialSetIds,
}: {
  sets: BuilderSet[];
  initialSetIds: string[];
}) {
  const validInitial = initialSetIds.filter((id) => sets.some((s) => s.id === id));
  const [scope, setScope] = useState<"all" | "sets">(validInitial.length > 0 ? "sets" : "all");
  const [selectedSets, setSelectedSets] = useState<string[]>(validInitial);
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "msq", "match"]);
  const [count, setCount] = useState(10);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const available = useMemo(() => {
    const scoped = scope === "all" ? sets : sets.filter((s) => selectedSets.includes(s.id));
    return scoped.reduce(
      (sum, entry) => sum + types.reduce((t, type) => t + entry.counts[type], 0),
      0,
    );
  }, [scope, selectedSets, sets, types]);

  const perTypeAvailable = useMemo(() => {
    const scoped = scope === "all" ? sets : sets.filter((s) => selectedSets.includes(s.id));
    const totals: Record<QuestionType, number> = { mcq: 0, msq: 0, match: 0 };
    for (const entry of scoped) {
      totals.mcq += entry.counts.mcq;
      totals.msq += entry.counts.msq;
      totals.match += entry.counts.match;
    }
    return totals;
  }, [scope, selectedSets, sets]);

  const smallestOption = COUNT_OPTIONS[0];
  const effectiveCount = Math.max(1, Math.min(count, available));

  async function onStart() {
    setError(null);
    if (types.length === 0) {
      setError("Pick at least one question type.");
      return;
    }
    if (scope === "sets" && selectedSets.length === 0) {
      setError("Choose at least one set.");
      return;
    }
    if (available === 0) {
      setError("No questions match those filters.");
      return;
    }

    setStarting(true);
    const result = await createTestSession({
      scope,
      setIds: scope === "sets" ? selectedSets : [],
      types,
      count: effectiveCount,
      label: label.trim() || undefined,
    });
    // On success the action redirects into the runner and never returns.
    setStarting(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card className="p-5">
        <Label>Scope</Label>
        <div className="mt-2.5 space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name="scope"
              checked={scope === "all"}
              onChange={() => setScope("all")}
              className="size-4 accent-[#4f46e5]"
            />
            Everything
            <span className="text-muted">
              ({sets.reduce((n, s) => n + s.counts.mcq + s.counts.msq + s.counts.match, 0)}{" "}
              questions)
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name="scope"
              checked={scope === "sets"}
              onChange={() => setScope("sets")}
              className="size-4 accent-[#4f46e5]"
            />
            Choose sets
          </label>
        </div>

        {scope === "sets" && (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3" data-testid="set-choices">
            {sets.map((entry) => {
              const total = entry.counts.mcq + entry.counts.msq + entry.counts.match;
              const checked = selectedSets.includes(entry.id);
              return (
                <label
                  key={entry.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                    checked ? "border-accent-fill/60 bg-accent-soft" : "border-line hover:bg-raised",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedSets((prev) =>
                          e.target.checked
                            ? [...prev, entry.id]
                            : prev.filter((id) => id !== entry.id),
                        )
                      }
                      className="size-4 shrink-0 accent-[#4f46e5]"
                    />
                    <span className="truncate font-medium text-ink">{entry.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {total} {plural(total, "question")}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <Label>Question types</Label>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {TYPE_OPTIONS.map((option) => {
            const checked = types.includes(option.value);
            const typeCount = perTypeAvailable[option.value];
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
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
                  className="mt-0.5 size-4 shrink-0 accent-[#4f46e5]"
                />
                <span>
                  <span className="font-medium text-ink">{option.label}</span>
                  <span className="block text-xs text-muted">
                    {option.hint} · {typeCount} available
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <Label>Number of questions</Label>
        {available >= smallestOption ? (
          <div className="mt-2.5 flex flex-wrap gap-2" data-testid="count-options">
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
          <p className="mt-2.5 text-sm text-ink" data-testid="count-all-note">
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

      <Card className="p-5">
        <Field
          label="Label (optional)"
          htmlFor="session-label"
          hint="Shown in history. Defaults to the scope you picked."
        >
          <Input
            id="session-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="e.g. Polity revision, night before mock"
          />
        </Field>
      </Card>

      <Button
        size="lg"
        className="w-full sm:w-auto"
        loading={starting}
        onClick={() => void onStart()}
        disabled={available === 0}
      >
        Start test · {effectiveCount} {plural(effectiveCount, "question")}
      </Button>
    </div>
  );
}
