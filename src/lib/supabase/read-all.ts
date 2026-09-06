/** PostgREST caps a single response at 1000 rows and silently ignores a
 *  larger `.limit()`. That is not an error — you simply get 1000 rows back and
 *  no indication that more exist, which reads as "this is everything".
 *
 *  It bit four queries here at once, each quietly wrong past a thousand
 *  questions: whole sets vanished from the test builder, library-wide tests
 *  only ever drew from the first thousand questions, and — worst — the import
 *  duplicate check compared against a fraction of the bank and let duplicates
 *  through.
 *
 *  Use this wherever a query must genuinely return everything. The caller
 *  supplies a range, so filters and ordering stay with the query itself. */
const PAGE_SIZE = 1000;

export async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  /** Guard against an unbounded read if a table grows far beyond expectations. */
  maxRows = 50_000,
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    // A short page means the end of the result set.
    if (batch.length < PAGE_SIZE) break;
  }

  return { rows, error: null };
}
