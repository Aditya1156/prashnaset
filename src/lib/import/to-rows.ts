import { fingerprintImported } from "./fingerprint";
import type { ImportedQuestion } from "./parse";
import { shuffleAvoidingOrder } from "@/lib/utils";
import type { Difficulty, MatchOptions, QuestionType } from "@/lib/types";

export interface QuestionInsert {
  set_id: string;
  owner_id: string;
  type: QuestionType;
  stem: string;
  options: string[] | MatchOptions;
  correct: string | string[];
  explanation: string | null;
  difficulty: Difficulty;
  position: number;
  fingerprint: string;
}

/** Maps parsed questions to database rows. For match questions the stored
 *  `options.right` column is ALWAYS a fresh code-side shuffle of the correct
 *  mapping — the file's ordering is never trusted. */
export function toQuestionRows(
  questions: ImportedQuestion[],
  target: { setId: string; ownerId: string },
  rng: () => number = Math.random,
): QuestionInsert[] {
  return questions.map((question, position) => {
    const base = {
      set_id: target.setId,
      owner_id: target.ownerId,
      stem: question.stem,
      explanation: question.explanation,
      difficulty: question.difficulty,
      position,
      fingerprint: fingerprintImported(question),
    };

    if (question.type === "match") {
      const correct = question.pairs.map((pair) => pair.right);
      const options: MatchOptions = {
        left: question.pairs.map((pair) => pair.left),
        right: shuffleAvoidingOrder(correct, rng),
      };
      return { ...base, type: "match", options, correct };
    }

    return {
      ...base,
      type: question.type,
      options: question.options,
      correct: question.correct,
    };
  });
}
