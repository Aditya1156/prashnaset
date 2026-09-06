/** Exam marking schemes.
 *
 *  BPSC prelims deducts a third of a mark for a wrong answer, so practising
 *  without a penalty trains a guessing habit that costs marks in the real
 *  paper. Unanswered questions are never penalised — that asymmetry is the
 *  whole point of the rule, and it should be visible while practising. */

export const BPSC_NEGATIVE_MARKING = 1 / 3;

/** Preset matching the BPSC prelims paper. */
export const BPSC_PRELIMS_MOCK = {
  questions: 150,
  minutes: 120,
  negativeMarking: BPSC_NEGATIVE_MARKING,
} as const;

export interface ScoreBreakdown {
  correct: number;
  wrong: number;
  unanswered: number;
  /** One mark per correct answer. */
  raw: number;
  /** Marks lost to wrong answers. */
  penalty: number;
  /** raw − penalty, floored at zero. */
  net: number;
  /** Net as a percentage of the maximum, rounded to one decimal. */
  percent: number;
}

/** Scores an attempt under a given penalty (0 for no negative marking). */
export function scoreAttempt(
  total: number,
  correct: number,
  wrong: number,
  negativeMarking: number = 0,
): ScoreBreakdown {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeCorrect = clampInt(correct, 0, safeTotal);
  const safeWrong = clampInt(wrong, 0, safeTotal - safeCorrect);
  // A rate, not a count: clampInt would truncate 1/3 to zero and silently
  // disable negative marking altogether.
  const penaltyRate = clampRate(negativeMarking);

  const penalty = round2(safeWrong * penaltyRate);
  // A negative total is not a thing in these exams; the floor is zero.
  const net = Math.max(0, round2(safeCorrect - penalty));

  return {
    correct: safeCorrect,
    wrong: safeWrong,
    unanswered: safeTotal - safeCorrect - safeWrong,
    raw: safeCorrect,
    penalty,
    net,
    percent: safeTotal === 0 ? 0 : round1((net / safeTotal) * 100),
  };
}

/** How many marks a wrong guess costs relative to a correct one — used to
 *  explain the trade-off in the UI. */
export function guessBreakEvenOptions(negativeMarking: number): number | null {
  if (negativeMarking <= 0) return null;
  // Guessing pays off when 1/n > (1 − 1/n) × penalty.
  return Math.round(1 + 1 / negativeMarking);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), Math.max(min, max));
}

function clampRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 1);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
