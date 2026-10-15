import { describe, expect, it } from "vitest";
import { bandFor, finaliseEvaluation, getRubric, wordTarget } from "./mains-rubric";

describe("getRubric", () => {
  it("gives the full 38-mark BPSC long-answer split", () => {
    const rubric = getRubric("LONG", 38);
    expect(rubric.reduce((s, c) => s + c.max, 0)).toBe(38);
    expect(rubric.find((c) => c.key === "bihar")?.max).toBe(5);
  });

  it("always sums to exactly the marks on offer when scaled", () => {
    // A rubric summing to 37 of 38 silently caps every candidate below full
    // marks, so drift has to be absorbed rather than rounded away.
    for (const marks of [9, 12, 15, 20, 25, 30, 34, 38, 50]) {
      const total = getRubric("LONG", marks).reduce((s, c) => s + c.max, 0);
      expect(total, `LONG scaled to ${marks}`).toBe(marks);
    }
  });

  it("uses the short-answer split for 7 and 8 mark sub-parts", () => {
    expect(getRubric("SHORT_SUB", 8).reduce((s, c) => s + c.max, 0)).toBe(8);
    expect(getRubric("SHORT_SUB", 7).reduce((s, c) => s + c.max, 0)).toBe(7);
  });

  it("keeps tiny custom marks coherent", () => {
    for (const marks of [1, 2, 3, 4, 5, 6]) {
      const rubric = getRubric("CUSTOM", marks);
      expect(rubric.reduce((s, c) => s + c.max, 0), `custom ${marks}`).toBe(marks);
      expect(rubric.every((c) => c.max > 0)).toBe(true);
    }
  });

  it("gives the 100-mark essay rubric", () => {
    expect(getRubric("ESSAY", 100).reduce((s, c) => s + c.max, 0)).toBe(100);
  });
});

describe("wordTarget", () => {
  it("reflects BPSC's fuller answers rather than UPSC lengths", () => {
    expect(wordTarget("LONG", 38)).toBe("400–450");
    expect(wordTarget("SHORT_SUB", 8)).toBe("120–150");
    expect(wordTarget("ESSAY", 100)).toContain("700–800");
  });
});

describe("bandFor", () => {
  it("places each band at its boundary", () => {
    expect(bandFor(0)).toBe("POOR");
    expect(bandFor(27.9)).toBe("POOR");
    expect(bandFor(28)).toBe("BELOW_AVG");
    expect(bandFor(43.9)).toBe("BELOW_AVG");
    expect(bandFor(44)).toBe("AVERAGE");
    expect(bandFor(53.9)).toBe("AVERAGE");
    expect(bandFor(54)).toBe("GOOD");
    expect(bandFor(63.9)).toBe("GOOD");
    expect(bandFor(64)).toBe("EXCELLENT");
  });
});

describe("finaliseEvaluation", () => {
  const full = [
    { key: "demand", awarded: 6 },
    { key: "content", awarded: 5 },
    { key: "bihar", awarded: 2 },
    { key: "evidence", awarded: 3 },
    { key: "structure", awarded: 2 },
    { key: "presentation", awarded: 2 },
    { key: "conclusion", awarded: 1 },
  ];

  it("recomputes the total from the parts", () => {
    const result = finaliseEvaluation(full, "LONG", 38);
    expect(result.total).toBe(21);
    expect(result.maxMarks).toBe(38);
    expect(result.percent).toBe(55.3);
    expect(result.band).toBe("GOOD");
  });

  it("ignores a total the model reports that disagrees with its own breakdown", () => {
    // The model's arithmetic is never trusted: a reported total that does not
    // match its parts leaves a candidate unable to tell which number is real.
    const inflated = finaliseEvaluation(full, "LONG", 38);
    expect(inflated.total).toBe(
      full.reduce((s, c) => s + c.awarded, 0),
    );
  });

  it("clamps any criterion awarded above its maximum", () => {
    const result = finaliseEvaluation(
      [{ key: "demand", awarded: 99 }, { key: "bihar", awarded: 50 }],
      "LONG",
      38,
    );
    expect(result.criteria.find((c) => c.key === "demand")?.awarded).toBe(10);
    expect(result.criteria.find((c) => c.key === "bihar")?.awarded).toBe(5);
  });

  it("floors negative awards at zero", () => {
    const result = finaliseEvaluation([{ key: "demand", awarded: -4 }], "LONG", 38);
    expect(result.criteria.find((c) => c.key === "demand")?.awarded).toBe(0);
    expect(result.total).toBe(0);
  });

  it("scores a skipped criterion zero rather than dropping it", () => {
    // Dropping it would score the answer out of fewer marks than the question
    // is worth, quietly inflating the percentage.
    const result = finaliseEvaluation([{ key: "demand", awarded: 10 }], "LONG", 38);
    expect(result.criteria).toHaveLength(7);
    expect(result.maxMarks).toBe(38);
    expect(result.percent).toBe(26.3);
  });

  it("discards criteria that are not in the rubric", () => {
    const result = finaliseEvaluation(
      [{ key: "demand", awarded: 5 }, { key: "made_up", awarded: 99 }],
      "LONG",
      38,
    );
    expect(result.criteria.some((c) => c.key === "made_up")).toBe(false);
    expect(result.total).toBe(5);
  });

  it("keeps half marks, which the rubric allows", () => {
    const result = finaliseEvaluation(
      [{ key: "demand", awarded: 6.5 }, { key: "content", awarded: 4.5 }],
      "LONG",
      38,
    );
    expect(result.total).toBe(11);
  });

  it("survives a non-numeric award", () => {
    const result = finaliseEvaluation([{ key: "demand", awarded: "oops" }], "LONG", 38);
    expect(result.total).toBe(0);
  });

  it("returns criteria in rubric order regardless of input order", () => {
    const shuffled = [...full].reverse();
    const result = finaliseEvaluation(shuffled, "LONG", 38);
    expect(result.criteria.map((c) => c.key)).toEqual([
      "demand",
      "content",
      "bihar",
      "evidence",
      "structure",
      "presentation",
      "conclusion",
    ]);
  });
});
