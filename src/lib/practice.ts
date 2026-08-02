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
