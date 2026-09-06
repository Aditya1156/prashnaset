import { describe, expect, it } from "vitest";
import {
  BPSC_NEGATIVE_MARKING,
  guessBreakEvenOptions,
  scoreAttempt,
} from "./scoring";

describe("scoreAttempt without a penalty", () => {
  it("is simply the number correct", () => {
    const s = scoreAttempt(10, 7, 3);
    expect(s.raw).toBe(7);
    expect(s.penalty).toBe(0);
    expect(s.net).toBe(7);
    expect(s.percent).toBe(70);
  });
});

describe("scoreAttempt with BPSC marking", () => {
  it("deducts a third of a mark per wrong answer", () => {
    // The worked example from the BPSC prelims scheme.
    const s = scoreAttempt(150, 96, 40, BPSC_NEGATIVE_MARKING);
    expect(s.raw).toBe(96);
    expect(s.penalty).toBeCloseTo(13.33, 2);
    expect(s.net).toBeCloseTo(82.67, 2);
    expect(s.unanswered).toBe(14);
  });

  it("never penalises unanswered questions", () => {
    const answered = scoreAttempt(10, 5, 5, BPSC_NEGATIVE_MARKING);
    const skipped = scoreAttempt(10, 5, 0, BPSC_NEGATIVE_MARKING);
    expect(skipped.penalty).toBe(0);
    expect(skipped.net).toBe(5);
    expect(answered.net).toBeLessThan(skipped.net);
    expect(skipped.unanswered).toBe(5);
  });

  it("floors the net score at zero rather than going negative", () => {
    const s = scoreAttempt(10, 0, 10, BPSC_NEGATIVE_MARKING);
    expect(s.penalty).toBeCloseTo(3.33, 2);
    expect(s.net).toBe(0);
    expect(s.percent).toBe(0);
  });

  it("handles a perfect paper", () => {
    const s = scoreAttempt(150, 150, 0, BPSC_NEGATIVE_MARKING);
    expect(s.net).toBe(150);
    expect(s.percent).toBe(100);
  });
});

describe("scoreAttempt input hygiene", () => {
  it("clamps counts that exceed the paper", () => {
    const s = scoreAttempt(5, 99, 99);
    expect(s.correct).toBe(5);
    expect(s.wrong).toBe(0);
    expect(s.unanswered).toBe(0);
  });

  it("copes with an empty test", () => {
    const s = scoreAttempt(0, 0, 0, BPSC_NEGATIVE_MARKING);
    expect(s.percent).toBe(0);
    expect(s.net).toBe(0);
  });
});

describe("guessBreakEvenOptions", () => {
  it("explains when a blind guess is worth taking", () => {
    // With 1/3 marking, a blind guess breaks even at four options.
    expect(guessBreakEvenOptions(BPSC_NEGATIVE_MARKING)).toBe(4);
    expect(guessBreakEvenOptions(0)).toBeNull();
  });
});
