"use client";

import { ClipboardList, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createAssignment } from "@/lib/actions/assignments";
import type { Difficulty, QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface AssignableSet {
  id: string;
  title: string;
  questionCount: number;
}

export interface AssignableLearner {
  id: string;
  name: string;
  email: string;
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "MCQ" },
  { value: "msq", label: "MSQ" },
  { value: "match", label: "Match" },
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COUNTS = [5, 10, 15, 20, 25];

export function CreateAssignmentButton({
  sets,
  learners,
}: {
  sets: AssignableSet[];
  learners: AssignableLearner[];
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
  const [assignAll, setAssignAll] = useState(true);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      // datetime-local has no zone; interpret in the admin's own timezone.
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assignAll,
      userIds: assignAll ? [] : userIds,
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
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
              {sets.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted">No sets with questions yet.</p>
              ) : (
                sets.map((set) => {
                  const checked = setIds.includes(set.id);
                  return (
                    <label
                      key={set.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
                        checked ? "border-accent-fill/60 bg-accent-soft" : "border-line",
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
                })
              )}
            </div>
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
            <div className="flex gap-2">
              {[
                { value: true, label: "Everyone" },
                { value: false, label: "Chosen learners" },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={assignAll === option.value}
                  onClick={() => setAssignAll(option.value)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium",
                    assignAll === option.value
                      ? "border-navy bg-navy text-on-navy"
                      : "border-line-strong text-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {!assignAll && (
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
            {!assignAll && userIds.length > 0 && (
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
