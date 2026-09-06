import { describe, expect, it } from "vitest";
import { readAllRows } from "@/lib/supabase/read-all";

/** Builds a fake pager over `total` rows that behaves like PostgREST: it never
 *  returns more than 1000 rows in one response. */
function fakeTable(total: number, calls: [number, number][] = []) {
  return (from: number, to: number) => {
    calls.push([from, to]);
    const size = Math.min(to - from + 1, 1000);
    const rows = [];
    for (let i = from; i < Math.min(from + size, total); i++) rows.push({ id: i });
    return Promise.resolve({ data: rows, error: null });
  };
}

describe("readAllRows", () => {
  it("returns everything past the 1000-row response cap", async () => {
    const { rows, error } = await readAllRows<{ id: number }>(fakeTable(1812));
    expect(error).toBeNull();
    expect(rows).toHaveLength(1812);
    expect(rows[0].id).toBe(0);
    expect(rows[1811].id).toBe(1811);
  });

  it("stops after one request when the first page is short", async () => {
    const calls: [number, number][] = [];
    const { rows } = await readAllRows<{ id: number }>(fakeTable(42, calls));
    expect(rows).toHaveLength(42);
    expect(calls).toEqual([[0, 999]]);
  });

  it("requests a further page when one comes back exactly full", async () => {
    const calls: [number, number][] = [];
    await readAllRows<{ id: number }>(fakeTable(2000, calls));
    // A full page is indistinguishable from the end, so it must ask again.
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("handles an empty table", async () => {
    const { rows, error } = await readAllRows<{ id: number }>(fakeTable(0));
    expect(rows).toEqual([]);
    expect(error).toBeNull();
  });

  it("surfaces an error with the rows read so far rather than throwing", async () => {
    const failure = { message: "connection lost" };
    const { rows, error } = await readAllRows<{ id: number }>((from) => {
      if (from === 0) {
        return Promise.resolve({
          data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: failure });
    });
    expect(error).toBe(failure);
    expect(rows).toHaveLength(1000);
  });

  it("stops at the guard rather than reading unboundedly", async () => {
    const calls: [number, number][] = [];
    const { rows } = await readAllRows<{ id: number }>(fakeTable(10_000, calls), 3000);
    expect(rows).toHaveLength(3000);
    expect(calls).toHaveLength(3);
  });
});
