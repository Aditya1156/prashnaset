/** Classifies a model-call failure.
 *
 *  Lives outside the "use server" action module because those may only export
 *  async functions, and outside the client so it can be unit tested without
 *  pulling in server-only code. */

/** Transient: the request was fine, the service just wasn't ready. Rate
 *  limits and 5xx recover on their own, so the caller should wait and retry
 *  rather than abandon the batch — free tiers throttle constantly. */
export function isTransientFailure(message: string): boolean {
  return (
    /HTTP 429\b|rate.?limit|too many requests|overloaded|try again|timed? ?out|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
      message,
    ) || /HTTP 5\d\d\b/.test(message)
  );
}

/** Fatal for the whole run: the account, key or project is the problem, so
 *  every remaining question would fail identically. Covers Google's billing
 *  wording ("dunning decision is deny") and the usual auth failures.
 *
 *  Checked AFTER isTransientFailure, because a 429 can read as "quota" while
 *  still being a per-minute limit that clears in seconds. */
export function isAccountLevelFailure(message: string): boolean {
  if (isTransientFailure(message)) return false;
  return /api[\s_-]?key|quota|permission[\s_-]?denied|billing|dunning|\bdeny\b|\bdenied\b|unauthenticated|unauthorized|suspend|not configured|invalid.?key|HTTP 40[13]\b/i.test(
    message,
  );
}
