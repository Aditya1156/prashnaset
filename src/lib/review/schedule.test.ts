import { describe, expect, it } from "vitest";
import {
  BOX_INTERVALS_DAYS,
  MAX_BOX,
  addDays,
  initialReviewState,
  isDue,
  nextReviewState,
  retentionLabel,
  toIsoDate,
} from "./schedule";

const TODAY = new Date(2026, 7, 3); // 3 Aug 2026, local time

describe("toIsoDate", () => {
  it("uses local calendar days, not UTC", () => {
    // Late-evening IST is already the next day in UTC; the review day must
    // follow the learner's calendar.
    expect(toIsoDate(new Date(2026, 7, 3, 23, 30))).toBe("2026-08-03");
    expect(toIsoDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("nextReviewState", () => {
  it("schedules a brand-new correct answer three days out", () => {
    const state = nextReviewState(null, true, TODAY);
    expect(state.box).toBe(1);
    expect(state.reps).toBe(1);
    expect(state.lapses).toBe(0);
    expect(state.dueOn).toBe(toIsoDate(addDays(TODAY, BOX_INTERVALS_DAYS[1])));
  });

  it("climbs the ladder with each success", () => {
    let state = nextReviewState(null, true, TODAY);
    const boxes = [state.box];
    for (let i = 0; i < 6; i++) {
      state = nextReviewState(state, true, TODAY);
      boxes.push(state.box);
    }
    expect(boxes).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(state.box).toBe(MAX_BOX);
  });

  it("sends a wrong answer back to the bottom and returns it tomorrow", () => {
    const strong = { box: 4, reps: 9, lapses: 0, dueOn: "2026-09-01", lastCorrect: true };
    const state = nextReviewState(strong, false, TODAY);
    expect(state.box).toBe(0);
    expect(state.lapses).toBe(1);
    expect(state.dueOn).toBe(toIsoDate(addDays(TODAY, 1)));
    expect(state.lastCorrect).toBe(false);
  });

  it("counts every answer as a repetition, right or wrong", () => {
    const first = nextReviewState(null, false, TODAY);
    expect(first.reps).toBe(1);
    expect(nextReviewState(first, true, TODAY).reps).toBe(2);
  });

  it("never schedules a review in the past", () => {
    let state = initialReviewState(TODAY);
    for (const correct of [true, false, true, true, false, true]) {
      state = nextReviewState(state, correct, TODAY);
      expect(state.dueOn > toIsoDate(TODAY)).toBe(true);
    }
  });
});

describe("isDue", () => {
  it("includes today and anything overdue", () => {
    expect(isDue({ ...initialReviewState(TODAY), dueOn: "2026-08-03" }, TODAY)).toBe(true);
    expect(isDue({ ...initialReviewState(TODAY), dueOn: "2026-07-01" }, TODAY)).toBe(true);
    expect(isDue({ ...initialReviewState(TODAY), dueOn: "2026-08-04" }, TODAY)).toBe(false);
  });
});

describe("retentionLabel", () => {
  it("describes each rung", () => {
    expect(retentionLabel(0)).toBe("Learning");
    expect(retentionLabel(2)).toBe("Familiar");
    expect(retentionLabel(5)).toBe("Long-term");
  });
});
