import { describe, expect, it } from "vitest";
import { formatClock, paletteStatus } from "./exam-panel";

describe("formatClock", () => {
  it("formats minutes and seconds with padding", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(5)).toBe("00:05");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(599)).toBe("09:59");
  });

  it("adds an hours segment past 60 minutes", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("never shows negative time when the clock overruns", () => {
    expect(formatClock(-30)).toBe("00:00");
  });
});

describe("paletteStatus", () => {
  it("distinguishes the four answered/marked states", () => {
    expect(paletteStatus(false, false)).toBe("unanswered");
    expect(paletteStatus(true, false)).toBe("answered");
    expect(paletteStatus(false, true)).toBe("marked");
    expect(paletteStatus(true, true)).toBe("answered-marked");
  });

  it("reports an explicit option-E skip", () => {
    expect(paletteStatus(false, false, true)).toBe("not-attempted");
  });

  it("keeps untouched distinct from a deliberate skip", () => {
    // The whole point of the BPSC E rule: a blank is penalised, an E is not,
    // so these two must never collapse into one palette state.
    expect(paletteStatus(false, false, false)).toBe("unanswered");
    expect(paletteStatus(false, false, true)).not.toBe("unanswered");
  });

  it("lets answering and review flags outrank a stale E flag", () => {
    expect(paletteStatus(true, false, true)).toBe("answered");
    expect(paletteStatus(false, true, true)).toBe("marked");
    expect(paletteStatus(true, true, true)).toBe("answered-marked");
  });
});
