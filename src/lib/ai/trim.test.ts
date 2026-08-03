import { describe, expect, it } from "vitest";
import { trimToCompleteSentence } from "./text";

describe("trimToCompleteSentence", () => {
  it("leaves well-formed text untouched", () => {
    const text = "Article 17 abolishes untouchability. It is enforceable against private persons.";
    expect(trimToCompleteSentence(text)).toBe(text);
  });

  it("drops a trailing partial sentence", () => {
    // The exact failure seen in the first live run: the model hit its token
    // ceiling and stopped mid-clause.
    const truncated =
      "Lions are absent from Indus seals. Rhinoceros and bull do appear. Bull is a domesticated animal that was";
    expect(trimToCompleteSentence(truncated)).toBe(
      "Lions are absent from Indus seals. Rhinoceros and bull do appear.",
    );
  });

  it("accepts sentences closed with quotes or brackets", () => {
    const text = 'The article forbids the practice of "untouchability."';
    expect(trimToCompleteSentence(text)).toBe(text);
  });

  it("keeps a single unpunctuated line rather than discarding everything", () => {
    expect(trimToCompleteSentence("Harappa sits on the Ravi")).toBe("Harappa sits on the Ravi");
  });

  it("handles question and exclamation endings", () => {
    expect(trimToCompleteSentence("Why does it matter? Because examiners")).toBe(
      "Why does it matter?",
    );
  });
});

