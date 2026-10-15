import { describe, expect, it } from "vitest";
import { inferDirective, inferType, parseMainsFile } from "./parse";

const ok = (raw: string) => {
  const result = parseMainsFile(raw);
  if ("error" in result) throw new Error(`expected success, got: ${result.error}`);
  return result;
};

describe("inferDirective", () => {
  it("prefers the longer directive when both appear", () => {
    // "critically examine" contains "examine"; picking the shorter one would
    // tell the evaluator to accept a plain description.
    expect(inferDirective("Critically examine the role of the Governor.")).toBe(
      "critically examine",
    );
  });

  it("finds a directive mid-sentence", () => {
    expect(inferDirective("In this context, discuss the Kosi project.")).toBe("discuss");
  });

  it("returns null when there is no directive verb", () => {
    expect(inferDirective("Bihar and the freedom struggle.")).toBeNull();
    expect(inferDirective(null)).toBeNull();
  });
});

describe("inferType", () => {
  it("maps BPSC's mark values onto the right rubric", () => {
    expect(inferType(8, "GS1")).toBe("SHORT_SUB");
    expect(inferType(7, "GS2")).toBe("SHORT_SUB");
    expect(inferType(38, "GS1")).toBe("LONG");
    expect(inferType(34, "GS2")).toBe("LONG");
    expect(inferType(100, "ESSAY")).toBe("ESSAY");
    expect(inferType(20, "GS1")).toBe("CUSTOM");
  });

  it("treats anything on the essay paper as an essay", () => {
    expect(inferType(50, "ESSAY")).toBe("ESSAY");
  });
});

describe("parseMainsFile", () => {
  it("reads a file with defaults at the top level", () => {
    const result = ok(
      JSON.stringify({
        paper: "GS2",
        section: 1,
        exam: "70th BPSC",
        year: 2025,
        questions: [
          { textEn: "Discuss cooperative federalism.", marks: 38, biharAngle: true },
        ],
      }),
    );
    const q = result.questions[0];
    expect(q.paper).toBe("GS2");
    expect(q.section).toBe(1);
    expect(q.examLabel).toBe("70th BPSC");
    expect(q.examYear).toBe(2025);
    expect(q.type).toBe("LONG");
    expect(q.directive).toBe("discuss");
    expect(q.biharAngle).toBe(true);
  });

  it("lets a question override the file default", () => {
    const result = ok(
      JSON.stringify({
        paper: "GS1",
        questions: [{ paper: "GS2", textEn: "Explain fiscal devolution.", marks: 38 }],
      }),
    );
    expect(result.questions[0].paper).toBe("GS2");
  });

  it("accepts a bare array", () => {
    const result = ok(
      JSON.stringify([{ paper: "GS1", textEn: "Describe the 1857 revolt.", marks: 38 }]),
    );
    expect(result.questions).toHaveLength(1);
  });

  it("only honours an explicit true for biharAngle", () => {
    // It changes a marking rule — a missing Bihar dimension also caps
    // "demand" — so a loose truthy value must never switch it on.
    const result = ok(
      JSON.stringify([
        { paper: "GS1", textEn: "A", marks: 38, biharAngle: "yes" },
        { paper: "GS1", textEn: "B", marks: 38, biharAngle: 1 },
        { paper: "GS1", textEn: "C", marks: 38 },
        { paper: "GS1", textEn: "D", marks: 38, biharAngle: true },
      ]),
    );
    expect(result.questions.map((q) => q.biharAngle)).toEqual([false, false, false, true]);
  });

  it("accepts Hindi-only questions", () => {
    const result = ok(
      JSON.stringify([{ paper: "GS1", textHi: "बिहार की भूमिका पर चर्चा कीजिए।", marks: 38 }]),
    );
    expect(result.questions[0].textHi).toBeTruthy();
    expect(result.questions[0].textEn).toBeNull();
  });

  it("skips bad rows but keeps the good ones", () => {
    const result = ok(
      JSON.stringify([
        { paper: "GS1", textEn: "Good one.", marks: 38 },
        { paper: "GS9", textEn: "Bad paper.", marks: 38 },
        { paper: "GS1", marks: 38 },
        { paper: "GS1", textEn: "Bad marks.", marks: 9999 },
      ]),
    );
    expect(result.questions).toHaveLength(1);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped[0].reason).toContain("GS9");
    expect(result.skipped[1].reason).toContain("No question text");
    expect(result.skipped[2].reason).toContain("1-300");
  });

  it("drops a section on the essay paper", () => {
    const result = ok(
      JSON.stringify([{ paper: "ESSAY", section: 2, textEn: "Essay topic.", marks: 100 }]),
    );
    expect(result.questions[0].section).toBeNull();
  });

  it("ignores an out-of-range section rather than storing it", () => {
    const result = ok(
      JSON.stringify([{ paper: "GS1", section: 7, textEn: "X", marks: 38 }]),
    );
    expect(result.questions[0].section).toBeNull();
  });

  it("ignores a word limit outside the sane range", () => {
    const result = ok(
      JSON.stringify([
        { paper: "GS1", textEn: "A", marks: 38, wordLimit: 450 },
        { paper: "GS1", textEn: "B", marks: 38, wordLimit: 5 },
      ]),
    );
    expect(result.questions[0].wordLimit).toBe(450);
    expect(result.questions[1].wordLimit).toBeNull();
  });

  it("reports malformed JSON rather than throwing", () => {
    expect(parseMainsFile("{ not json")).toEqual({ error: "That file isn't valid JSON." });
  });

  it("rejects an empty file and a file with nothing usable", () => {
    expect(parseMainsFile("[]")).toHaveProperty("error");
    const allBad = parseMainsFile(JSON.stringify([{ paper: "XX", textEn: "a", marks: 1 }]));
    expect(allBad).toHaveProperty("error");
  });

  it("caps tag count", () => {
    const result = ok(
      JSON.stringify([
        { paper: "GS1", textEn: "A", marks: 38, tags: Array.from({ length: 30 }, (_, i) => `t${i}`) },
      ]),
    );
    expect(result.questions[0].tags).toHaveLength(12);
  });
});
