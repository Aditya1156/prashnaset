/** Plain text helpers for model replies.
 *
 *  Separate from client.ts because that module is server-only and cannot be
 *  imported by unit tests. */

/** Drops a trailing partial sentence. Models that hit their token ceiling
 *  stop mid-clause, and half a sentence in a study aid is worse than a
 *  slightly shorter one. Text with no sentence break at all is returned
 *  unchanged, so a single well-formed line isn't thrown away. */
export function trimToCompleteSentence(text: string): string {
  const trimmed = text.trim();
  if (/[.!?]["')\]]?$/.test(trimmed)) return trimmed;

  const lastBreak = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
  );
  return lastBreak > 0 ? trimmed.slice(0, lastBreak + 1) : trimmed;
}
