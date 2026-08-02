import { isMatchOptions, type QuestionRow } from "@/lib/types";

/** MCQ: exact text equality (options are canonical stored strings). */
export function gradeMcq(selected: string, correct: string): boolean {
  return selected.trim() === correct.trim();
}

/** MSQ: set equality — every correct option selected and nothing else.
 *  No partial credit. Order and duplicates don't matter. */
export function gradeMsq(selected: readonly string[], correct: readonly string[]): boolean {
  const selectedSet = new Set(selected.map((s) => s.trim()));
  const correctSet = new Set(correct.map((c) => c.trim()));
  if (selectedSet.size !== correctSet.size) return false;
  for (const value of correctSet) {
    if (!selectedSet.has(value)) return false;
  }
  return true;
}

/** Match: full-mapping equality — the chosen right value for every left row
 *  must equal the correct one, in left order. Any unanswered row fails. */
export function gradeMatch(
  selected: ReadonlyArray<string | null | undefined>,
  correct: readonly string[],
): boolean {
  if (selected.length !== correct.length) return false;
  return correct.every((value, i) => {
    const chosen = selected[i];
    return typeof chosen === "string" && chosen.trim() === value.trim();
  });
}

type GradeableQuestion = Pick<QuestionRow, "type" | "correct" | "options">;

/** Grades an untrusted `selected` payload against a stored question.
 *  Malformed payloads grade as incorrect rather than throwing. */
export function gradeAnswer(question: GradeableQuestion, selected: unknown): boolean {
  switch (question.type) {
    case "mcq":
      return (
        typeof selected === "string" &&
        typeof question.correct === "string" &&
        gradeMcq(selected, question.correct)
      );
    case "msq":
      return (
        Array.isArray(selected) &&
        selected.every((s): s is string => typeof s === "string") &&
        Array.isArray(question.correct) &&
        gradeMsq(selected, question.correct)
      );
    case "match": {
      if (!Array.isArray(selected) || !Array.isArray(question.correct)) return false;
      if (!isMatchOptions(question.options)) return false;
      const valid = selected.every((s) => s === null || typeof s === "string");
      return valid && gradeMatch(selected as (string | null)[], question.correct);
    }
    default:
      return false;
  }
}
