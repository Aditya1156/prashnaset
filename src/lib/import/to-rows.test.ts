import { describe, expect, it } from "vitest";
import { toQuestionRows } from "./to-rows";
import type { ImportedMatch, ImportedMcq } from "./parse";
import { isMatchOptions } from "@/lib/types";

const TARGET = { setId: "set-1", ownerId: "user-1" };

/** Deterministic rng for reproducible shuffles. */
function seededRng(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const matchQuestion: ImportedMatch = {
  type: "match",
  stem: "Match each body with its article.",
  pairs: [
    { left: "Election Commission", right: "Article 324" },
    { left: "UPSC", right: "Article 315" },
    { left: "CAG", right: "Article 148" },
    { left: "Finance Commission", right: "Article 280" },
  ],
  explanation: null,
  difficulty: "medium",
};

describe("toQuestionRows", () => {
  it("maps mcq rows verbatim with position", () => {
    const q: ImportedMcq = {
      type: "mcq",
      stem: "S",
      options: ["a", "b"],
      correct: "b",
      explanation: "why",
      difficulty: "easy",
    };
    const [row] = toQuestionRows([q], TARGET);
    expect(row).toMatchObject({
      set_id: "set-1",
      owner_id: "user-1",
      type: "mcq",
      stem: "S",
      options: ["a", "b"],
      correct: "b",
      explanation: "why",
      difficulty: "easy",
      position: 0,
    });
  });

  it("stores match correct in left order and right as a shuffle of it", () => {
    const [row] = toQuestionRows([matchQuestion], TARGET, seededRng());
    expect(row.correct).toEqual([
      "Article 324",
      "Article 315",
      "Article 148",
      "Article 280",
    ]);
    if (!isMatchOptions(row.options)) throw new Error("expected match options");
    expect(row.options.left).toEqual([
      "Election Commission",
      "UPSC",
      "CAG",
      "Finance Commission",
    ]);
    // Same multiset…
    expect([...row.options.right].sort()).toEqual([...(row.correct as string[])].sort());
    // …but never the file's ordering.
    expect(row.options.right).not.toEqual(row.correct);
  });

  it("avoids the identity ordering across many seeds", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const [row] = toQuestionRows([matchQuestion], TARGET, seededRng(seed));
      if (!isMatchOptions(row.options)) throw new Error("expected match options");
      expect(row.options.right).not.toEqual(row.correct);
    }
  });

  it("assigns sequential positions", () => {
    const rows = toQuestionRows([matchQuestion, matchQuestion, matchQuestion], TARGET, seededRng());
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  });
});
