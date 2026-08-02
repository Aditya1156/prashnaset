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
  it("distinguishes all four exam states", () => {
    expect(paletteStatus(false, false)).toBe("unanswered");
    expect(paletteStatus(true, false)).toBe("answered");
    expect(paletteStatus(false, true)).toBe("marked");
    expect(paletteStatus(true, true)).toBe("answered-marked");
  });
});
