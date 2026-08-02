import { describe, expect, it } from "vitest";
import { gradeAnswer, gradeMatch, gradeMcq, gradeMsq } from "./grade";

describe("gradeMcq", () => {
  it("passes on exact text equality", () => {
    expect(gradeMcq("Article 17", "Article 17")).toBe(true);
  });

  it("tolerates surrounding whitespace but not different text", () => {
    expect(gradeMcq("  Article 17 ", "Article 17")).toBe(true);
    expect(gradeMcq("article 17", "Article 17")).toBe(false);
    expect(gradeMcq("Article 14", "Article 17")).toBe(false);
  });
});

describe("gradeMsq", () => {
  it("requires set equality in any order", () => {
    expect(gradeMsq(["B", "A"], ["A", "B"])).toBe(true);
  });

  it("gives no partial credit", () => {
    expect(gradeMsq(["A"], ["A", "B"])).toBe(false);
    expect(gradeMsq(["A", "B", "C"], ["A", "B"])).toBe(false);
    expect(gradeMsq([], ["A"])).toBe(false);
  });

  it("ignores duplicate selections", () => {
    expect(gradeMsq(["A", "A", "B"], ["A", "B"])).toBe(true);
  });
});

describe("gradeMatch", () => {
  const correct = ["r1", "r2", "r3"];

  it("requires the full mapping in left order", () => {
    expect(gradeMatch(["r1", "r2", "r3"], correct)).toBe(true);
  });

  it("fails on any wrong or missing row", () => {
    expect(gradeMatch(["r1", "r3", "r2"], correct)).toBe(false);
    expect(gradeMatch(["r1", null, "r3"], correct)).toBe(false);
    expect(gradeMatch(["r1", "r2"], correct)).toBe(false);
  });
});

describe("gradeAnswer", () => {
  const mcq = { type: "mcq" as const, correct: "B", options: ["A", "B"] };
  const msq = { type: "msq" as const, correct: ["A", "C"], options: ["A", "B", "C"] };
  const match = {
    type: "match" as const,
    correct: ["r1", "r2"],
    options: { left: ["l1", "l2"], right: ["r2", "r1"] },
  };

  it("routes each type to its grader", () => {
    expect(gradeAnswer(mcq, "B")).toBe(true);
    expect(gradeAnswer(mcq, "A")).toBe(false);
    expect(gradeAnswer(msq, ["C", "A"])).toBe(true);
    expect(gradeAnswer(msq, ["A"])).toBe(false);
    expect(gradeAnswer(match, ["r1", "r2"])).toBe(true);
    expect(gradeAnswer(match, ["r2", "r1"])).toBe(false);
  });

  it("grades malformed payloads as incorrect instead of throwing", () => {
    expect(gradeAnswer(mcq, ["B"])).toBe(false);
    expect(gradeAnswer(msq, "A")).toBe(false);
    expect(gradeAnswer(match, "r1")).toBe(false);
    expect(gradeAnswer(mcq, undefined)).toBe(false);
    expect(gradeAnswer(msq, [1, 2])).toBe(false);
  });
});
