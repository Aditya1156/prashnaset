export type QuestionType = "mcq" | "msq" | "match";
export type Difficulty = "easy" | "medium" | "hard";
export type Language = "en" | "hi";

/** Stored options shape for match questions. `right` is always a code-side
 *  shuffle of the correct mapping — never the file's ordering. */
export interface MatchOptions {
  left: string[];
  right: string[];
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface QuestionSetRow {
  id: string;
  owner_id: string;
  title: string;
  language: Language;
  source_file_ref: string | null;
  question_count: number;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  set_id: string;
  owner_id: string;
  type: QuestionType;
  stem: string;
  options: string[] | MatchOptions | null;
  /** mcq: string; msq: string[]; match: string[] (right value per left, in left order) */
  correct: string | string[];
  explanation: string | null;
  difficulty: Difficulty;
  status: "active" | "removed";
  position: number;
  created_at: string;
}

export interface TestSessionRow {
  id: string;
  owner_id: string;
  label: string | null;
  question_count: number;
  correct_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface AttemptRow {
  id: string;
  owner_id: string;
  question_id: string;
  session_id: string | null;
  selected: unknown;
  is_correct: boolean;
  created_at: string;
}

export function isMatchOptions(options: unknown): options is MatchOptions {
  return (
    typeof options === "object" &&
    options !== null &&
    Array.isArray((options as MatchOptions).left) &&
    Array.isArray((options as MatchOptions).right)
  );
}
