"use client";

import { Check, ChevronRight, Flag, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/input";
import { finishSession, submitAttempt } from "@/lib/actions/sessions";
import { isMatchOptions, type MatchOptions, type QuestionType } from "@/lib/types";
import { cn, plural, scorePercent, scoreTone } from "@/lib/utils";

export interface RunnerQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options: string[] | MatchOptions | null;
}

interface Reveal {
  isCorrect: boolean;
  correct: string | string[];
  explanation: string | null;
}

interface RunnerProps {
  sessionId: string;
  label: string;
  questions: RunnerQuestion[];
  initialAnsweredIds: string[];
}

const typeLabels: Record<QuestionType, string> = { mcq: "MCQ", msq: "MSQ", match: "Match" };
const typeHints: Record<QuestionType, string> = {
  mcq: "Pick one option.",
  msq: "Select all that apply.",
  match: "Choose the match for every row.",
};

const toneText = {
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
} as const;

function FinishScreen({
  label,
  correctCount,
  total,
  sessionId,
}: {
  label: string;
  correctCount: number;
  total: number;
  sessionId: string;
}) {
  const percent = scorePercent(correctCount, total);
  const tone = scoreTone(percent);
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="mx-auto max-w-md text-center" data-testid="finish-screen">
      <p className="text-sm text-muted">{label}</p>
      <div className={cn("relative mx-auto mt-6 size-36", toneText[tone])}>
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            strokeWidth="10"
            className="stroke-raised"
          />
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-4xl text-ink tabular-nums">
          {percent}%
        </span>
      </div>
      <h1 className="mt-6 font-display text-2xl text-ink" data-testid="finish-summary">
        {correctCount} of {total} correct
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Every answer is saved — review them any time from History.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <ButtonLink href={`/history/${sessionId}`}>Review answers</ButtonLink>
        <ButtonLink href="/test/new" variant="secondary">
          Build another test
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="ghost">
          Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

export function TestRunner({ sessionId, label, questions, initialAnsweredIds }: RunnerProps) {
  const firstUnanswered = questions.findIndex((q) => !initialAnsweredIds.includes(q.id));
  const [answeredCount, setAnsweredCount] = useState(initialAnsweredIds.length);
  const [index, setIndex] = useState(firstUnanswered === -1 ? questions.length : firstUnanswered);
  const [mcqChoice, setMcqChoice] = useState<string | null>(null);
  const [msqChoices, setMsqChoices] = useState<string[]>([]);
  const [matchChoices, setMatchChoices] = useState<(string | null)[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<{ correctCount: number; total: number } | null>(null);

  const total = questions.length;
  const question = index < total ? questions[index] : null;

  function resetSelection(next: RunnerQuestion | null) {
    setMcqChoice(null);
    setMsqChoices([]);
    setMatchChoices(
      next && next.type === "match" && isMatchOptions(next.options)
        ? next.options.left.map(() => null)
        : [],
    );
    setReveal(null);
    setError(null);
  }

  const canCheck =
    question !== null &&
    (question.type === "mcq"
      ? mcqChoice !== null
      : question.type === "msq"
        ? msqChoices.length > 0
        : matchChoices.length > 0 && matchChoices.every((choice) => choice !== null));

  async function onCheck() {
    if (!question || !canCheck) return;
    setBusy(true);
    setError(null);
    const selected =
      question.type === "mcq"
        ? mcqChoice!
        : question.type === "msq"
          ? msqChoices
          : (matchChoices as string[]);
    const result = await submitAttempt({ sessionId, questionId: question.id, selected });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReveal(result);
    setAnsweredCount((prev) => prev + 1);
  }

  async function onAdvance() {
    const nextIndex = index + 1;
    if (nextIndex < total) {
      setIndex(nextIndex);
      resetSelection(questions[nextIndex]);
      return;
    }
    await onFinish();
  }

  async function onFinish() {
    setBusy(true);
    setError(null);
    const result = await finishSession(sessionId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFinished({ correctCount: result.correctCount, total: result.total });
  }

  // First render for a match question needs its row array sized.
  if (
    question &&
    question.type === "match" &&
    isMatchOptions(question.options) &&
    matchChoices.length !== question.options.left.length &&
    reveal === null
  ) {
    setMatchChoices(question.options.left.map(() => null));
  }

  if (finished) {
    return (
      <FinishScreen
        label={label}
        correctCount={finished.correctCount}
        total={finished.total}
        sessionId={sessionId}
      />
    );
  }

  if (!question) {
    // Resumed a session whose questions are all answered (or all deleted).
    return (
      <div className="mx-auto max-w-md text-center">
        <Flag className="mx-auto size-8 text-accent" aria-hidden />
        <h1 className="mt-4 font-display text-2xl text-ink">
          {total > 0 ? "All questions answered" : "This test has no questions left"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {total > 0
            ? "Finish to lock in your score."
            : "Its questions were deleted with their set. Finish to close it."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button className="mt-6" onClick={() => void onFinish()} loading={busy}>
          Finish test
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-muted">{label}</p>
        <Link
          href="/history"
          className="shrink-0 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Save & exit
        </Link>
      </div>

      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span data-testid="progress-text">
            Question {index + 1} of {total}
          </span>
          <span className="tabular-nums">{answeredCount} answered</span>
        </div>
        <Progress value={answeredCount} max={total} label="Test progress" />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge tone="accent">{typeLabels[question.type]}</Badge>
          <span className="text-xs text-muted">{typeHints[question.type]}</span>
        </div>
        <h2 className="mt-3 text-base leading-relaxed font-medium text-ink sm:text-lg" data-testid="stem">
          {question.stem}
        </h2>

        <div className="mt-5">
          {question.type === "mcq" && Array.isArray(question.options) && (
            <div className="space-y-2" role="radiogroup" aria-label="Options">
              {question.options.map((option) => {
                const chosen = mcqChoice === option;
                const isCorrectOption =
                  reveal !== null && typeof reveal.correct === "string" && reveal.correct === option;
                const wrongPick = reveal !== null && chosen && !isCorrectOption;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={reveal !== null || busy}
                    onClick={() => setMcqChoice(option)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      reveal === null &&
                        (chosen
                          ? "border-accent-fill bg-accent-soft text-ink"
                          : "border-line text-ink hover:border-accent-fill/50 hover:bg-raised/60"),
                      isCorrectOption && "border-success/60 bg-success-soft font-medium text-ink",
                      wrongPick && "border-danger/60 bg-danger-soft text-ink",
                      reveal !== null && !isCorrectOption && !wrongPick && "border-line text-muted opacity-70",
                    )}
                  >
                    <span className="min-w-0 break-words">{option}</span>
                    {isCorrectOption && <Check className="size-4 shrink-0 text-success" aria-hidden />}
                    {wrongPick && <X className="size-4 shrink-0 text-danger" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "msq" && Array.isArray(question.options) && (
            <div className="space-y-2">
              {question.options.map((option) => {
                const chosen = msqChoices.includes(option);
                const isCorrectOption =
                  reveal !== null && Array.isArray(reveal.correct) && reveal.correct.includes(option);
                const wrongPick = reveal !== null && chosen && !isCorrectOption;
                const missedCorrect = reveal !== null && !chosen && isCorrectOption;
                return (
                  <button
                    key={option}
                    type="button"
                    role="checkbox"
                    aria-checked={chosen}
                    disabled={reveal !== null || busy}
                    onClick={() =>
                      setMsqChoices((prev) =>
                        chosen ? prev.filter((o) => o !== option) : [...prev, option],
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      reveal === null &&
                        (chosen
                          ? "border-accent-fill bg-accent-soft text-ink"
                          : "border-line text-ink hover:border-accent-fill/50 hover:bg-raised/60"),
                      isCorrectOption && "border-success/60 bg-success-soft text-ink",
                      wrongPick && "border-danger/60 bg-danger-soft text-ink",
                      reveal !== null && !isCorrectOption && !wrongPick && "border-line text-muted opacity-70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4.5 shrink-0 items-center justify-center rounded border",
                        chosen || isCorrectOption
                          ? "border-accent-fill bg-accent-fill text-on-accent"
                          : "border-line-strong bg-surface",
                        isCorrectOption && "border-success bg-success",
                        wrongPick && "border-danger bg-danger",
                      )}
                    >
                      {(chosen || isCorrectOption) && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{option}</span>
                    {missedCorrect && (
                      <span className="shrink-0 text-[11px] font-medium tracking-wide text-success uppercase">
                        missed
                      </span>
                    )}
                    {wrongPick && <X className="size-4 shrink-0 text-danger" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "match" && isMatchOptions(question.options) && (
            <div className="space-y-2.5">
              {question.options.left.map((left, row) => {
                const chosen = matchChoices[row] ?? null;
                const correctValue =
                  reveal !== null && Array.isArray(reveal.correct) ? reveal.correct[row] : null;
                const rowCorrect = reveal !== null && chosen !== null && chosen === correctValue;
                return (
                  <div
                    key={`${left}-${row}`}
                    className={cn(
                      "rounded-xl border px-3.5 py-3",
                      reveal === null
                        ? "border-line"
                        : rowCorrect
                          ? "border-success/60 bg-success-soft"
                          : "border-danger/60 bg-danger-soft",
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium text-ink">{left}</span>
                      {reveal === null ? (
                        <Select
                          aria-label={`Match for ${left}`}
                          className="sm:max-w-56"
                          value={chosen ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            setMatchChoices((prev) =>
                              prev.map((value, i) => (i === row ? e.target.value || null : value)),
                            )
                          }
                        >
                          <option value="">Choose…</option>
                          {question.options && isMatchOptions(question.options)
                            ? question.options.right.map((right, i) => (
                                <option key={`${right}-${i}`} value={right}>
                                  {right}
                                </option>
                              ))
                            : null}
                        </Select>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm">
                          {rowCorrect ? (
                            <Check className="size-4 text-success" aria-hidden />
                          ) : (
                            <X className="size-4 text-danger" aria-hidden />
                          )}
                          <span className="text-ink">{chosen ?? "—"}</span>
                        </span>
                      )}
                    </div>
                    {reveal !== null && !rowCorrect && correctValue && (
                      <p className="mt-1.5 text-xs text-muted">
                        Correct: <span className="font-medium text-ink">{correctValue}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {reveal !== null && (
          <div
            className={cn(
              "mt-5 rounded-xl border px-4 py-3",
              reveal.isCorrect ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft",
            )}
            data-testid="feedback"
          >
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold",
                reveal.isCorrect ? "text-success" : "text-danger",
              )}
            >
              {reveal.isCorrect ? (
                <>
                  <Check className="size-4" aria-hidden /> Correct
                </>
              ) : (
                <>
                  <X className="size-4" aria-hidden /> Not quite
                </>
              )}
            </p>
            {reveal.explanation && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{reveal.explanation}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          {reveal === null ? (
            <Button onClick={() => void onCheck()} disabled={!canCheck} loading={busy}>
              Check answer
            </Button>
          ) : (
            <Button onClick={() => void onAdvance()} loading={busy} data-testid="advance">
              {index + 1 < total ? (
                <>
                  Next question <ChevronRight className="size-4" aria-hidden />
                </>
              ) : (
                <>
                  Finish test <Flag className="size-4" aria-hidden />
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      <p className="mt-4 text-center text-xs text-muted">
        {answeredCount} of {total} {plural(total, "question")} answered · progress saves
        automatically
      </p>
    </div>
  );
}
