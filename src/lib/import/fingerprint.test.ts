import { describe, expect, it } from "vitest";
import {
  fingerprintImported,
  fingerprintParts,
  fingerprintStored,
  normalizeText,
} from "./fingerprint";
import type { ImportedMatch, ImportedMcq, ImportedMsq } from "./parse";

const mcq: ImportedMcq = {
  type: "mcq",
  stem: "Which article abolishes untouchability?",
  options: ["Article 14", "Article 17", "Article 19"],
  correct: "Article 17",
  explanation: null,
  difficulty: "medium",
};

describe("normalizeText", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeText("  Which  ARTICLE, exactly? ")).toBe("which article exactly");
  });

  it("folds smart quotes to plain ones", () => {
    expect(normalizeText("India’s constitution")).toBe(normalizeText("India's constitution"));
  });
});

describe("fingerprintImported", () => {
  it("matches the same question formatted differently", () => {
    const reformatted: ImportedMcq = {
      ...mcq,
      stem: "WHICH ARTICLE ABOLISHES UNTOUCHABILITY??",
      options: ["article 19", "  Article 14 ", "ARTICLE 17"],
    };
    expect(fingerprintImported(reformatted)).toBe(fingerprintImported(mcq));
  });

  it("separates questions that share a generic stem", () => {
    const a: ImportedMcq = { ...mcq, stem: "Which of the following is correct?", options: ["A", "B"], correct: "A" };
    const b: ImportedMcq = { ...a, options: ["C", "D"], correct: "C" };
    expect(fingerprintImported(a)).not.toBe(fingerprintImported(b));
  });

  it("separates the same stem asked as a different type", () => {
    const asMsq: ImportedMsq = {
      type: "msq",
      stem: mcq.stem,
      options: mcq.options,
      correct: ["Article 17"],
      explanation: null,
      difficulty: "medium",
    };
    expect(fingerprintImported(asMsq)).not.toBe(fingerprintImported(mcq));
  });

  it("covers both sides of a match question", () => {
    const match: ImportedMatch = {
      type: "match",
      stem: "Match the bodies.",
      pairs: [
        { left: "ECI", right: "Article 324" },
        { left: "UPSC", right: "Article 315" },
      ],
      explanation: null,
      difficulty: "medium",
    };
    const reordered: ImportedMatch = { ...match, pairs: [...match.pairs].reverse() };
    expect(fingerprintImported(reordered)).toBe(fingerprintImported(match));
  });
});

describe("fingerprintStored", () => {
  it("agrees with the imported form for mcq", () => {
    expect(
      fingerprintStored({
        type: "mcq",
        stem: mcq.stem,
        options: mcq.options,
        correct: mcq.correct,
      }),
    ).toBe(fingerprintImported(mcq));
  });

  it("agrees with the imported form for match questions", () => {
    const match: ImportedMatch = {
      type: "match",
      stem: "Match the rivers.",
      pairs: [
        { left: "Ganga", right: "Gangotri" },
        { left: "Yamuna", right: "Yamunotri" },
      ],
      explanation: null,
      difficulty: "medium",
    };
    // Stored rows keep `right` shuffled, with `correct` holding the true order.
    expect(
      fingerprintStored({
        type: "match",
        stem: match.stem,
        options: { left: ["Ganga", "Yamuna"], right: ["Yamunotri", "Gangotri"] },
        correct: ["Gangotri", "Yamunotri"],
      }),
    ).toBe(fingerprintImported(match));
  });

  it("handles rows with no options", () => {
    expect(fingerprintStored({ type: "mcq", stem: "Bare", options: null, correct: "x" })).toBe(
      fingerprintParts("mcq", "Bare", []),
    );
  });
});
