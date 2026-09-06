/** Spaced-repetition scheduling.
 *
 *  A Leitner ladder rather than full SM-2: the intervals are fixed and
 *  legible, which matters for a study tool a learner has to trust. Getting a
 *  question right moves it one rung up the ladder; getting it wrong sends it
 *  back to the bottom, because a lapse means the memory was not there.
 *
 *  Pure and dependency-free so the whole schedule is unit tested. */

/** Days until the next review, indexed by box. Box 0 is "you just missed
 *  this, see it tomorrow"; box 5 is long-term retention. */
export const BOX_INTERVALS_DAYS = [1, 3, 7, 21, 60, 120] as const;

export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;

export interface ReviewState {
  box: number;
  reps: number;
  lapses: number;
  /** ISO date (YYYY-MM-DD). */
  dueOn: string;
  lastCorrect: boolean | null;
}

export function initialReviewState(today: Date = new Date()): ReviewState {
  return { box: 0, reps: 0, lapses: 0, dueOn: toIsoDate(today), lastCorrect: null };
}

/** Formats a date as YYYY-MM-DD in local time. Using the ISO string directly
 *  would shift the day for anyone east or west of UTC. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Applies one answer to a question's schedule. */
export function nextReviewState(
  previous: ReviewState | null,
  correct: boolean,
  today: Date = new Date(),
): ReviewState {
  const current = previous ?? initialReviewState(today);

  if (!correct) {
    // A lapse resets the ladder. Half-measures here are how learners end up
    // "reviewing" things they cannot actually recall.
    return {
      box: 0,
      reps: current.reps + 1,
      lapses: current.lapses + 1,
      dueOn: toIsoDate(addDays(today, BOX_INTERVALS_DAYS[0])),
      lastCorrect: false,
    };
  }

  const box = Math.min(current.box + 1, MAX_BOX);
  return {
    box,
    reps: current.reps + 1,
    lapses: current.lapses,
    dueOn: toIsoDate(addDays(today, BOX_INTERVALS_DAYS[box])),
    lastCorrect: true,
  };
}

/** True when a question is ready to be reviewed. */
export function isDue(state: ReviewState, today: Date = new Date()): boolean {
  return state.dueOn <= toIsoDate(today);
}

/** Human label for how firmly a question is held, used in the UI. */
export function retentionLabel(box: number): string {
  if (box <= 0) return "Learning";
  if (box === 1) return "Shaky";
  if (box === 2) return "Familiar";
  if (box === 3) return "Solid";
  return "Long-term";
}
