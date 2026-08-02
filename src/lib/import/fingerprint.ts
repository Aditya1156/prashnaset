import { isMatchOptions } from "@/lib/types";
import type { ImportedQuestion } from "./parse";

/** Collapses formatting noise so the same question re-exported from a
 *  differently formatted file still compares equal: case, punctuation,
 *  smart quotes and whitespace are all ignored. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Identity of a question for duplicate detection: its type, its stem, and
 *  its answer choices as a set. Options are sorted so a reordered export is
 *  still recognised, and they are included so genuinely different questions
 *  sharing a generic stem ("Which of the following is correct?") are not
 *  wrongly merged. */
export function fingerprintParts(
  type: string,
  stem: string,
  choices: readonly string[],
): string {
  const normalizedChoices = choices
    .map(normalizeText)
    .filter((choice) => choice.length > 0)
    .sort();
  return [type, normalizeText(stem), normalizedChoices.join("|")].join("::");
}

/** Fingerprint for a freshly parsed import row. */
export function fingerprintImported(question: ImportedQuestion): string {
  const choices =
    question.type === "match"
      ? question.pairs.flatMap((pair) => [pair.left, pair.right])
      : question.options;
  return fingerprintParts(question.type, question.stem, choices);
}

/** Fingerprint for a row already stored in the database. Kept in the same
 *  module as the import version so the two can never drift apart. */
export function fingerprintStored(row: {
  type: string;
  stem: string;
  options: unknown;
  correct: unknown;
}): string {
  let choices: string[] = [];
  if (isMatchOptions(row.options)) {
    const right = Array.isArray(row.correct) ? (row.correct as string[]) : row.options.right;
    choices = [...row.options.left, ...right];
  } else if (Array.isArray(row.options)) {
    choices = (row.options as unknown[]).filter(
      (option): option is string => typeof option === "string",
    );
  }
  return fingerprintParts(row.type, row.stem, choices);
}
