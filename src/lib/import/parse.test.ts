import { describe, expect, it } from "vitest";
import {
  formatSkip,
  parseQuestionImport,
  resolveAnswer,
  type ImportedMcq,
  type ImportedMsq,
  type ImportedMatch,
} from "./parse";

const OPTIONS = ["Article 14", "Article 17", "Article 19", "Article 21"];

function mcq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "mcq",
    question: "Which article abolishes untouchability?",
    options: OPTIONS,
    answer: "Article 17",
    ...overrides,
  };
}

describe("parseQuestionImport — envelope", () => {
  it("accepts a wrapper object with title and language", () => {
    const result = parseQuestionImport({
      title: "  Polity basics  ",
      language: "HI",
      questions: [mcq()],
    });
    expect(result.title).toBe("Polity basics");
    expect(result.language).toBe("hi");
    expect(result.questions).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("accepts a bare array and defaults language to en", () => {
    const result = parseQuestionImport([mcq()]);
    expect(result.title).toBeNull();
    expect(result.language).toBe("en");
    expect(result.questions).toHaveLength(1);
  });

  it("rejects a file that is neither an array nor an object with questions", () => {
    const result = parseQuestionImport("just a string");
    expect(result.questions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].index).toBe(0);
    expect(result.skipped[0].reason).toContain("questions");
  });

  it("rejects an object whose questions field is missing", () => {
    const result = parseQuestionImport({ title: "Empty" });
    expect(result.questions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});

describe("parseQuestionImport — mcq answers", () => {
  it("resolves answer by option text, case-insensitively", () => {
    const result = parseQuestionImport([mcq({ answer: "article 17" })]);
    const q = result.questions[0] as ImportedMcq;
    expect(q.correct).toBe("Article 17");
  });

  it("resolves a 0-based numeric index", () => {
    const result = parseQuestionImport([mcq({ answer: 1 })]);
    expect((result.questions[0] as ImportedMcq).correct).toBe("Article 17");
  });

  it("falls back to 1-based when out of 0-based range", () => {
    const result = parseQuestionImport([mcq({ answer: 4 })]);
    expect((result.questions[0] as ImportedMcq).correct).toBe("Article 21");
  });

  it("resolves letters, including trailing bracket forms", () => {
    expect((parseQuestionImport([mcq({ answer: "b" })]).questions[0] as ImportedMcq).correct).toBe(
      "Article 17",
    );
    expect(
      (parseQuestionImport([mcq({ answer: "C)" })]).questions[0] as ImportedMcq).correct,
    ).toBe("Article 19");
  });

  it("resolves numeric strings as indexes", () => {
    const result = parseQuestionImport([mcq({ answer: "1" })]);
    expect((result.questions[0] as ImportedMcq).correct).toBe("Article 17");
  });

  it("prefers exact option text over index interpretation for numbers", () => {
    const result = parseQuestionImport([
      { question: "Pick", options: ["1", "2", "3"], answer: 2 },
    ]);
    expect((result.questions[0] as ImportedMcq).correct).toBe("2");
  });

  it("skips when the answer matches nothing", () => {
    const result = parseQuestionImport([mcq(), mcq({ answer: "Article 99" }), mcq()]);
    expect(result.questions).toHaveLength(2);
    expect(result.skipped).toEqual([
      { index: 2, reason: "answer doesn't match any option" },
    ]);
    expect(formatSkip(result.skipped[0])).toBe("Question 2: answer doesn't match any option");
  });

  it("skips an mcq with multiple answers", () => {
    const result = parseQuestionImport([mcq({ answer: ["Article 14", "Article 17"] })]);
    expect(result.questions).toHaveLength(0);
    expect(result.skipped[0].reason).toContain("multiple answers");
  });

  it("accepts a single-element answers array for an explicit mcq", () => {
    const result = parseQuestionImport([mcq({ answer: undefined, answers: ["Article 19"] })]);
    expect((result.questions[0] as ImportedMcq).correct).toBe("Article 19");
  });
});

describe("parseQuestionImport — aliases and inference", () => {
  it("accepts q/choices/correctIndex aliases", () => {
    const result = parseQuestionImport([
      { q: "Capital of France?", choices: ["Paris", "Lyon"], correctIndex: 0 },
    ]);
    const q = result.questions[0] as ImportedMcq;
    expect(q.type).toBe("mcq");
    expect(q.stem).toBe("Capital of France?");
    expect(q.correct).toBe("Paris");
  });

  it("accepts stem/correctOption and solution aliases", () => {
    const result = parseQuestionImport([
      {
        stem: "2 + 2?",
        options: ["3", "4"],
        correctOption: "4",
        solution: "Basic addition.",
      },
    ]);
    const q = result.questions[0] as ImportedMcq;
    expect(q.correct).toBe("4");
    expect(q.explanation).toBe("Basic addition.");
  });

  it("infers msq from an answers array", () => {
    const result = parseQuestionImport([
      { question: "Pick evens", options: ["1", "2", "3", "4"], answers: ["2", "4"] },
    ]);
    const q = result.questions[0] as ImportedMsq;
    expect(q.type).toBe("msq");
    expect(q.correct).toEqual(["2", "4"]);
  });

  it("infers msq from an array in correct", () => {
    const result = parseQuestionImport([
      { question: "Pick odds", options: ["1", "2", "3"], correct: [0, "3"] },
    ]);
    const q = result.questions[0] as ImportedMsq;
    expect(q.type).toBe("msq");
    expect(q.correct).toEqual(["1", "3"]);
  });

  it("infers match from a pairs array and accepts the matches alias", () => {
    const viaPairs = parseQuestionImport([
      {
        question: "Match rivers",
        pairs: [
          { left: "Ganga", right: "Gangotri" },
          { left: "Yamuna", right: "Yamunotri" },
        ],
      },
    ]);
    expect((viaPairs.questions[0] as ImportedMatch).type).toBe("match");

    const viaMatches = parseQuestionImport([
      {
        question: "Match rivers",
        matches: [
          ["Ganga", "Gangotri"],
          ["Yamuna", "Yamunotri"],
        ],
      },
    ]);
    const q = viaMatches.questions[0] as ImportedMatch;
    expect(q.pairs).toEqual([
      { left: "Ganga", right: "Gangotri" },
      { left: "Yamuna", right: "Yamunotri" },
    ]);
  });

  it("defaults a bare single-answer question to mcq", () => {
    const result = parseQuestionImport([
      { question: "Yes?", options: ["Yes", "No"], answer: "Yes" },
    ]);
    expect(result.questions[0].type).toBe("mcq");
  });
});

describe("parseQuestionImport — msq specifics", () => {
  it("dedupes answers that resolve to the same option", () => {
    const result = parseQuestionImport([
      { question: "Pick", options: ["A", "B", "C"], answers: ["a", 0, "A"] },
    ]);
    expect((result.questions[0] as ImportedMsq).correct).toEqual(["A"]);
  });

  it("skips when any answer fails to resolve", () => {
    const result = parseQuestionImport([
      { question: "Pick", options: ["A", "B"], answers: ["A", "Z"] },
    ]);
    expect(result.questions).toHaveLength(0);
    expect(result.skipped[0].reason).toContain("doesn't match any option");
  });
});

describe("parseQuestionImport — match specifics", () => {
  it("skips match questions with too few or too many pairs", () => {
    const one = parseQuestionImport([
      { type: "match", question: "M", pairs: [{ left: "a", right: "b" }] },
    ]);
    expect(one.skipped[0].reason).toContain("between 2 and 6 pairs");

    const seven = parseQuestionImport([
      {
        type: "match",
        question: "M",
        pairs: Array.from({ length: 7 }, (_, i) => ({ left: `l${i}`, right: `r${i}` })),
      },
    ]);
    expect(seven.skipped[0].reason).toContain("between 2 and 6 pairs");
  });

  it("skips a pair with missing sides and reports which one", () => {
    const result = parseQuestionImport([
      {
        type: "match",
        question: "M",
        pairs: [{ left: "a", right: "b" }, { left: "c" }],
      },
    ]);
    expect(result.skipped[0].reason).toBe("pair 2 is missing left or right text");
  });
});

describe("parseQuestionImport — row hygiene", () => {
  it("skips non-object rows and rows without question text", () => {
    const result = parseQuestionImport([42, { options: ["a", "b"], answer: "a" }]);
    expect(result.questions).toHaveLength(0);
    expect(result.skipped).toEqual([
      { index: 1, reason: "not a question object" },
      { index: 2, reason: "missing question text" },
    ]);
  });

  it("skips unknown types", () => {
    const result = parseQuestionImport([mcq({ type: "truefalse" })]);
    expect(result.skipped[0].reason).toBe('unknown type "truefalse"');
  });

  it("enforces option count bounds", () => {
    const tooFew = parseQuestionImport([mcq({ options: ["only one"], answer: 0 })]);
    expect(tooFew.skipped[0].reason).toContain("between 2 and 8 options");

    const tooMany = parseQuestionImport([
      mcq({ options: Array.from({ length: 9 }, (_, i) => `o${i}`), answer: 0 }),
    ]);
    expect(tooMany.skipped[0].reason).toContain("between 2 and 8 options");
  });

  it("coerces numeric options to text", () => {
    const result = parseQuestionImport([
      { question: "Pick", options: [1, 2, 3], answer: "2" },
    ]);
    const q = result.questions[0] as ImportedMcq;
    expect(q.options).toEqual(["1", "2", "3"]);
    expect(q.correct).toBe("2");
  });

  it("defaults invalid difficulty to medium and keeps valid ones", () => {
    const result = parseQuestionImport([
      mcq({ difficulty: "brutal" }),
      mcq({ difficulty: "Hard" }),
    ]);
    expect(result.questions[0].difficulty).toBe("medium");
    expect(result.questions[1].difficulty).toBe("hard");
  });

  it("imports good rows even when bad rows are present (2 good + 2 bad)", () => {
    const result = parseQuestionImport([
      mcq(),
      { question: "Broken", options: ["a", "b"], answer: "z" },
      { question: "Also broken" },
      { question: "Fine", options: ["x", "y"], answer: "y" },
    ]);
    expect(result.questions).toHaveLength(2);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.map((s) => s.index)).toEqual([2, 3]);
  });
});

describe("resolveAnswer", () => {
  it("returns null for unresolvable values", () => {
    expect(resolveAnswer("zz", OPTIONS)).toBeNull();
    expect(resolveAnswer(99, OPTIONS)).toBeNull();
    expect(resolveAnswer(null, OPTIONS)).toBeNull();
    expect(resolveAnswer({}, OPTIONS)).toBeNull();
  });
});
