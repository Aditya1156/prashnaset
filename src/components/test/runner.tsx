"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Flag, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiExplainButton } from "@/components/questions/ai-explain-button";
import { AiInsight } from "@/components/questions/ai-insight";
import { StudyTools, type QuestionNote } from "@/components/study/study-tools";
import { ExamClock, QuestionPalette } from "@/components/test/exam-panel";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/input";
import { finishSession, setQuestionMarked, submitAttempt } from "@/lib/actions/sessions";
import { scoreAttempt } from "@/lib/scoring";
import { isMatchOptions, type MatchOptions, type QuestionType } from "@/lib/types";
import { cn, plural, scorePercent, scoreTone } from "@/lib/utils";

export interface RunnerQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options: string[] | MatchOptions | null;
}

export type Selection = string | string[] | (string | null)[];

interface Reveal {
  isCorrect: boolean;
  correct: string | string[];
  explanation: string | null;
  aiExplanation: string | null;
  aiTip: string | null;
}

interface RunnerProps {
  sessionId: string;
  label: string;
  questions: RunnerQuestion[];
  /** questionId -> the answer already stored (resumed session). */
  initialAnswers: Record<string, Selection>;
  initialMarked: string[];
  /** ISO deadline; null runs untimed. */
  expiresAt: string | null;
  examMode: boolean;
  /** questionId -> the learner's existing bookmark/note, if any. */
  initialNotes: Record<string, QuestionNote>;
}

const typeLabels: Record<QuestionType, string> = { mcq: "MCQ", msq: "MSQ", match: "Match" };
const typeHints: Record<QuestionType, string> = {
  mcq: "Pick one option.",
  msq: "Select all that apply.",
  match: "Choose the match for every row.",
};

const OPTION_LABELS = "ABCDEFGHIJKLMNOP";
const toneText = { success: "text-success", warn: "text-warn", danger: "text-danger" } as const;

function FinishScreen({
  label,
  correctCount,
  wrongCount,
  negativeMarking,
  total,
  sessionId,
  timedOut,
}: {
  label: string;
  correctCount: number;
  wrongCount: number;
  negativeMarking: number;
  total: number;
  sessionId: string;
  timedOut: boolean;
}) {
  // With negative marking the honest headline is the net score, not the hit
  // rate — that is the number the commission would put on the merit list.
  const score = scoreAttempt(total, correctCount, wrongCount, negativeMarking);
  const penalised = negativeMarking > 0;
  const percent = penalised ? score.percent : scorePercent(correctCount, total);
  const tone = scoreTone(percent);
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="mx-auto max-w-md text-center" data-testid="finish-screen">
      <p className="text-sm text-muted">{label}</p>
      {timedOut && (
        <p className="mt-2 inline-flex rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
          Time expired — submitted automatically
        </p>
      )}
      <div className={cn("relative mx-auto mt-6 size-44 sm:size-52", toneText[tone])}>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 size-60 rounded-full bg-accent-fill/10 blur-3xl" aria-hidden />
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle cx="64" cy="64" r="54" fill="none" strokeWidth="10" className="stroke-raised" />
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
        <span className="absolute inset-0 flex items-center justify-center font-display text-5xl sm:text-6xl text-ink tabular-nums">
          {percent}%
        </span>
      </div>
      <h1 className="mt-6 font-display text-2xl text-ink" data-testid="finish-summary">
        {correctCount} of {total} correct
      </h1>
      <p className="mt-1 text-sm text-muted">
        {percent >= 90 ? "Outstanding!" : percent >= 70 ? "Well done!" : percent >= 50 ? "Getting there!" : "Keep practicing!"}
      </p>
      {penalised ? (
        <dl
          className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line-strong/60 bg-line-strong/60 text-center"
          data-testid="net-score"
        >
          {[
            { term: "Raw", value: score.raw.toFixed(2) },
            { term: "Penalty", value: `-${score.penalty.toFixed(2)}` },
            { term: "Net", value: score.net.toFixed(2) },
          ].map((row) => (
            <div key={row.term} className="bg-surface px-2 py-2.5">
              <dt className="text-[0.65rem] uppercase tracking-wide text-faint">{row.term}</dt>
              <dd className="mt-0.5 font-display text-lg text-ink tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-1.5 text-sm text-muted">
        {penalised
          ? `${score.wrong} wrong, ${score.unanswered} skipped — each wrong answer costs ${negativeMarking.toFixed(2)} marks.`
          : "Every answer is saved — review them any time from History."}
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

export function TestRunner({
  sessionId,
  label,
  questions,
  initialAnswers,
  initialMarked,
  expiresAt,
  examMode,
  initialNotes,
}: RunnerProps) {
  const total = questions.length;

  const firstUnanswered = questions.findIndex((q) => initialAnswers[q.id] === undefined);
  const [index, setIndex] = useState(
    firstUnanswered === -1 ? (examMode ? 0 : total) : firstUnanswered,
  );
  const [answers, setAnswers] = useState<Record<string, Selection>>(initialAnswers);
  const [marked, setMarked] = useState<Set<string>>(new Set(initialMarked));
  // Drafts and reveals are keyed by question so navigating is pure state
  // derivation — no effect syncing, so nothing can flash or clobber an edit.
  const [drafts, setDrafts] = useState<Record<string, Selection>>(initialAnswers);
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<{
    correctCount: number;
    wrongCount: number;
    negativeMarking: number;
    total: number;
  } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  /** Phones only: the palette is collapsed until asked for. */
  const [paletteOpen, setPaletteOpen] = useState(false);

  const deadline = useMemo(
    () => (expiresAt ? new Date(expiresAt).getTime() : null),
    [expiresAt],
  );
  /** null until the first client tick. Reading the clock during render would
   *  produce a different string on the server than in the browser, which
   *  React reports as a hydration mismatch. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const question = index < total ? questions[index] : null;
  const answeredFlags = questions.map((q) => answers[q.id] !== undefined);
  const markedFlags = questions.map((q) => marked.has(q.id));
  const answeredCount = answeredFlags.filter(Boolean).length;

  /** Empty answer shaped for the question type. */
  function blankDraft(q: RunnerQuestion): Selection | null {
    if (q.type === "match" && isMatchOptions(q.options)) return q.options.left.map(() => null);
    if (q.type === "msq") return [];
    return null;
  }

  const draft: Selection | null = question
    ? (drafts[question.id] ?? blankDraft(question))
    : null;
  const reveal: Reveal | null = question ? (reveals[question.id] ?? null) : null;

  function setDraft(value: Selection) {
    if (!question) return;
    setDrafts((prev) => ({ ...prev, [question.id]: value }));
  }

  function goTo(nextIndex: number) {
    setError(null);
    setIndex(nextIndex);
  }

  const submitFinish = useCallback(
    async (auto: boolean) => {
      setBusy(true);
      setError(null);
      const result = await finishSession(sessionId);
      setBusy(false);
      if (!result.ok) {
        if (!auto) setError(result.error);
        return;
      }
      setTimedOut(auto);
      setFinished({
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        negativeMarking: result.negativeMarking,
        total: result.total,
      });
    },
    [sessionId],
  );

  // Countdown. The server also enforces the deadline, so this is presentation
  // plus a courteous auto-submit rather than the security boundary.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (deadline === null || finished) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        void submitFinish(true);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, finished, submitFinish]);

  const canSubmitAnswer =
    draft !== null &&
    (Array.isArray(draft) ? draft.length > 0 && draft.every((v) => v !== null) : draft !== "");

  async function saveAnswer(selection: Selection) {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: selection }));
    const result = await submitAttempt({
      sessionId,
      questionId: question.id,
      selected: selection,
      reveal: false,
    });
    if (!result.ok) setError(result.error);
  }

  async function onCheck() {
    if (!question || draft === null) return;
    setBusy(true);
    setError(null);
    const result = await submitAttempt({
      sessionId,
      questionId: question.id,
      selected: draft,
      reveal: true,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.isCorrect !== undefined) {
      setReveals((prev) => ({
        ...prev,
        [question.id]: {
          isCorrect: result.isCorrect!,
          correct: result.correct,
          explanation: result.explanation,
          aiExplanation: result.aiExplanation ?? null,
          aiTip: result.aiTip ?? null,
        },
      }));
      setAnswers((prev) => ({ ...prev, [question.id]: draft }));
    }
  }

  async function toggleMarked() {
    if (!question) return;
    const next = new Set(marked);
    const nowMarked = !next.has(question.id);
    if (nowMarked) next.add(question.id);
    else next.delete(question.id);
    setMarked(next);
    await setQuestionMarked(sessionId, question.id, nowMarked);
  }

  async function goNext() {
    if (index + 1 < total) goTo(index + 1);
    else if (!examMode) await submitFinish(false);
  }

  if (finished) {
    return (
      <FinishScreen
        label={label}
        correctCount={finished.correctCount}
        wrongCount={finished.wrongCount}
        negativeMarking={finished.negativeMarking}
        total={finished.total}
        sessionId={sessionId}
        timedOut={timedOut}
      />
    );
  }

  if (!question) {
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
        <Button className="mt-6" onClick={() => void submitFinish(false)} loading={busy}>
          Finish test
        </Button>
      </div>
    );
  }

  const questionBody = (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <span className="absolute top-0 left-0 right-0 h-1 bg-accent-fill" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="accent">{typeLabels[question.type]}</Badge>
          <span className="text-xs text-muted">{typeHints[question.type]}</span>
        </div>
        {examMode && (
          <button
            type="button"
            onClick={() => void toggleMarked()}
            aria-pressed={marked.has(question.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              marked.has(question.id)
                ? "border-warn bg-warn-soft text-warn"
                : "border-line-strong text-muted hover:bg-raised hover:text-ink",
            )}
          >
            <Flag className="size-3.5" aria-hidden />
            {marked.has(question.id) ? "Marked for review" : "Mark for review"}
          </button>
        )}
      </div>

      <h2
        className="mt-3 text-lg leading-relaxed font-medium text-ink sm:text-xl"
        data-testid="stem"
      >
        {question.stem}
      </h2>

      <div className="mt-5">
        {question.type === "mcq" && Array.isArray(question.options) && (
          <div className="space-y-2.5" role="radiogroup" aria-label="Options">
            {question.options.map((option, i) => {
              const chosen = draft === option;
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
                  onClick={() => {
                    setDraft(option);
                    if (examMode) void saveAnswer(option);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all",
                    reveal === null &&
                      (chosen
                        ? "border-accent-fill bg-accent-soft border-l-4 border-l-accent-fill shadow-sm text-ink"
                        : "border-line text-ink hover:border-accent-fill/50 hover:bg-raised/60"),
                    isCorrectOption && "border-success/60 bg-success-soft font-medium text-ink",
                    wrongPick && "border-danger/60 bg-danger-soft text-ink",
                    reveal !== null &&
                      !isCorrectOption &&
                      !wrongPick &&
                      "border-line text-muted opacity-70",
                  )}
                >
                  <span className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold transition-colors",
                    reveal === null && (chosen ? "bg-accent-fill text-on-accent" : "bg-raised text-muted"),
                    isCorrectOption && "bg-success text-white",
                    wrongPick && "bg-danger text-white",
                    reveal !== null && !isCorrectOption && !wrongPick && "bg-raised/60 text-faint",
                  )}>
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{option}</span>
                  {isCorrectOption && <Check className="size-4 shrink-0 text-success" aria-hidden />}
                  {wrongPick && <X className="size-4 shrink-0 text-danger" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}

        {question.type === "msq" && Array.isArray(question.options) && (
          <div className="space-y-2.5">
            {question.options.map((option, i) => {
              const current = Array.isArray(draft) ? (draft as string[]) : [];
              const chosen = current.includes(option);
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
                  onClick={() => {
                    const next = chosen
                      ? current.filter((o) => o !== option)
                      : [...current, option];
                    setDraft(next);
                    if (examMode && next.length > 0) void saveAnswer(next);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all",
                    reveal === null &&
                      (chosen
                        ? "border-accent-fill bg-accent-soft text-ink"
                        : "border-line text-ink hover:border-accent-fill/50 hover:bg-raised/60"),
                    isCorrectOption && "border-success/60 bg-success-soft text-ink",
                    wrongPick && "border-danger/60 bg-danger-soft text-ink",
                    reveal !== null &&
                      !isCorrectOption &&
                      !wrongPick &&
                      "border-line text-muted opacity-70",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-semibold transition-colors",
                      reveal === null && (chosen ? "bg-accent-fill text-on-accent" : "bg-raised text-muted"),
                      isCorrectOption && "bg-success text-white",
                      wrongPick && "bg-danger text-white",
                      reveal !== null && !isCorrectOption && !wrongPick && "bg-raised/60 text-faint",
                    )}
                  >
                    {chosen || isCorrectOption ? <Check className="size-3.5" /> : OPTION_LABELS[i]}
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
              const current = Array.isArray(draft) ? (draft as (string | null)[]) : [];
              const chosen = current[row] ?? null;
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
                        onChange={(e) => {
                          const next = question.options && isMatchOptions(question.options)
                            ? question.options.left.map((_, i) =>
                                i === row ? e.target.value || null : (current[i] ?? null),
                              )
                            : current;
                          setDraft(next);
                          if (examMode && next.every((v) => v !== null)) void saveAnswer(next);
                        }}
                      >
                        <option value="">Choose…</option>
                        {isMatchOptions(question.options)
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
            reveal.isCorrect
              ? "border-success/40 bg-success-soft"
              : "border-danger/40 bg-danger-soft",
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
          {reveal.aiExplanation || reveal.aiTip ? (
            <AiInsight
              explanation={reveal.aiExplanation}
              tip={reveal.aiTip}
              className="mt-3 bg-surface/70"
            />
          ) : (
            <AiExplainButton key={question.id} questionId={question.id} className="mt-3" />
          )}
          {/* Keyed so moving to the next question remounts with that
              question's own bookmark and note, not the previous one's. */}
          <StudyTools
            key={question.id}
            questionId={question.id}
            initial={initialNotes[question.id]}
            className="mt-3"
          />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        {examMode ? (
          <>
            <Button
              variant="secondary"
              disabled={index === 0 || busy}
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            {index + 1 < total ? (
              <Button onClick={() => void goNext()} data-testid="advance">
                Next <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => void submitFinish(false)} loading={busy} data-testid="advance">
                Submit test <Flag className="size-4" aria-hidden />
              </Button>
            )}
          </>
        ) : (
          <div className="ml-auto">
            {reveal === null ? (
              <Button size="lg" onClick={() => void onCheck()} disabled={!canSubmitAnswer} loading={busy}>
                Check answer
              </Button>
            ) : (
              <Button onClick={() => void goNext()} loading={busy} data-testid="advance">
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
        )}
      </div>
    </Card>
  );

  return (
    <div className={cn("mx-auto", examMode ? "max-w-5xl" : "max-w-2xl")}>
      {/* Sticky on phones so the clock and progress never scroll away mid-question. */}
      <div className="sticky top-14 z-30 -mx-4 mb-5 border-b border-line bg-background/95 px-4 pt-2 pb-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:backdrop-blur-none">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted">{label}</p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {deadline !== null && secondsLeft !== null && (
              <ExamClock secondsLeft={secondsLeft} />
            )}
            <Link
              href="/history"
              className="hidden shrink-0 text-sm text-muted underline-offset-4 hover:text-ink hover:underline sm:block"
            >
              Save &amp; exit
            </Link>
          </div>
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="progress-text">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-fill font-display text-sm font-semibold text-on-accent tabular-nums shadow-sm">
              {index + 1}
            </span>
            <span className="text-sm text-muted">
              of <span className="font-medium text-ink">{total}</span>
            </span>
          </div>
          <span className="text-xs text-muted tabular-nums">{answeredCount} answered</span>
        </div>
        <Progress value={answeredCount} max={total} label="Test progress" />
      </div>

      {examMode ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div key={index} className="animate-question-in">
            {questionBody}
          </div>
          {/* Palette sits above the question on phones (collapsed) and beside
              it on desktop, so jumping between questions is always one tap. */}
          <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
            <Card className="p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setPaletteOpen((open) => !open)}
                aria-expanded={paletteOpen}
                className="flex w-full items-center justify-between gap-2 text-left lg:hidden"
              >
                <span className="font-display text-base text-ink">
                  All questions
                  <span className="ml-2 text-xs font-normal text-muted tabular-nums">
                    {answeredCount}/{total} answered
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted transition-transform",
                    paletteOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              <div className={cn(paletteOpen ? "mt-4 block" : "hidden", "lg:mt-0 lg:block")}>
                <QuestionPalette
                  total={total}
                  current={index}
                  answeredIds={answeredFlags}
                  markedIds={markedFlags}
                  onJump={(next) => {
                    goTo(next);
                    setPaletteOpen(false);
                  }}
                />
                <Button
                  variant="navy"
                  className="mt-5 w-full"
                  loading={busy}
                  onClick={() => void submitFinish(false)}
                >
                  Submit test
                </Button>
                {answeredCount < total && (
                  <p className="mt-2 text-center text-[11px] text-muted">
                    {total - answeredCount} {plural(total - answeredCount, "question")} still
                    unanswered
                  </p>
                )}
              </div>
            </Card>
          </aside>
        </div>
      ) : (
        <div key={index} className="animate-question-in">
          {questionBody}
        </div>
      )}

      {!examMode && (
        <p className="mt-4 text-center text-xs text-muted">
          {answeredCount} of {total} {plural(total, "question")} answered · progress saves
          automatically
        </p>
      )}
    </div>
  );
}
