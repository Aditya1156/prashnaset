/** Classifies a model-call failure.
 *
 *  Lives outside the "use server" action module because those may only export
 *  async functions, and outside gemini.ts so it can be unit tested without
 *  pulling in server-only code. */

/** True when the failure is about the account or key rather than this one
 *  question — those repeat identically for every remaining call, so a batch
 *  should stop instead of making two dozen doomed requests.
 *
 *  Covers Google's own phrasings, including the billing block that reads
 *  "Lightning dunning decision is deny for project: …". */
export function isAccountLevelFailure(message: string): boolean {
  return /api[\s_-]?key|quota|rate limit|permission[\s_-]?denied|billing|dunning|\bdeny\b|\bdenied\b|unauthenticated|suspend|not configured|HTTP 40[0139]\b|HTTP 429\b/i.test(
    message,
  );
}
