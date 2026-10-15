"use client";

import { Check, ChevronsUpDown, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setActiveExam } from "@/lib/actions/exams";
import type { ExamOption } from "@/lib/exam";
import { cn } from "@/lib/utils";

/** Switches which exam a learner is preparing for, without signing out.
 *  Hidden entirely when there is only one track — a picker with a single
 *  option is just noise. */
export function ExamSwitcher({
  options,
  current,
}: {
  options: ExamOption[];
  current: ExamOption | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!current || options.length < 2) return null;

  async function choose(exam: ExamOption) {
    if (exam.id === current?.id) {
      setOpen(false);
      return;
    }
    setBusy(exam.id);
    setError(null);
    const result = await setActiveExam(exam.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Couldn't switch exam.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="exam-switcher"
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong"
      >
        <GraduationCap className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
            Preparing for
          </span>
          <span className="block truncate text-sm font-medium text-ink">{current.name}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" aria-hidden />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg"
          >
            {options.map((exam) => {
              const active = exam.id === current.id;
              return (
                <button
                  key={exam.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={busy !== null}
                  onClick={() => void choose(exam)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors disabled:opacity-60",
                    active ? "bg-accent-soft" : "hover:bg-raised",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        active ? "font-semibold text-accent-soft-ink" : "text-ink",
                      )}
                    >
                      {exam.name}
                    </span>
                    {exam.description && (
                      <span className="block truncate text-xs text-muted">
                        {exam.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
