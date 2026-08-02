/** Shared practice-engine constants.
 *
 *  Lives outside the "use server" action modules on purpose: those files may
 *  only export async functions, so a constant there breaks every import of
 *  the module. */

/** How far back the mistake drill looks. A week is long enough for genuine
 *  forgetting to set in (so the retest is worth something) while still being
 *  recent enough that the material is part of the current study cycle. */
export const MISTAKE_WINDOW_DAYS = 7;

/** Rough pacing used for time estimates and the default exam clock. */
export const SECONDS_PER_QUESTION = 45;

/** Upper bound on a single test. Deliberately generous — a full-length mock
 *  should be limited by the size of the bank, not by the app. This exists
 *  only so a malformed request can't ask for a million rows. */
export const MAX_TEST_QUESTIONS = 500;

/** Lengths offered as quick picks; "All" is offered separately and uses
 *  however many questions actually match the filters. */
export const TEST_LENGTH_PRESETS = [5, 10, 15, 20, 25, 50, 100] as const;

/** Questions per AI generation run. Kept modest because free model tiers
 *  rate-limit hard and a server action should not run for minutes. */
export const AI_BATCH_SIZE = 25;
