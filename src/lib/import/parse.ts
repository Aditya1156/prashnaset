import type { Difficulty, Language } from "@/lib/types";

/** Hard limits for the import pipeline. Enforced client- AND server-side. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_QUESTIONS_PER_FILE = 2000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const MIN_PAIRS = 2;
const MAX_PAIRS = 6;
const MAX_TITLE_LENGTH = 200;

export interface ImportedMcq {
  type: "mcq";
  stem: string;
  options: string[];
  correct: string;
  explanation: string | null;
  difficulty: Difficulty;
}

export interface ImportedMsq {
  type: "msq";
  stem: string;
  options: string[];
  correct: string[];
  explanation: string | null;
  difficulty: Difficulty;
}

export interface ImportedMatch {
  type: "match";
  stem: string;
  pairs: { left: string; right: string }[];
  explanation: string | null;
  difficulty: Difficulty;
}

export type ImportedQuestion = ImportedMcq | ImportedMsq | ImportedMatch;

/** `index` is the question's 1-based position in the file; 0 marks a
 *  file-level problem rather than a per-question one. */
export interface ImportSkip {
  index: number;
  reason: string;
}

export interface ImportParseResult {
  title: string | null;
  language: Language;
  questions: ImportedQuestion[];
  skipped: ImportSkip[];
}

export function formatSkip(skip: ImportSkip): string {
  return skip.index > 0 ? `Question ${skip.index}: ${skip.reason}` : skip.reason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerces a primitive to display text. Returns null for empty or
 *  non-text-like values. */
function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** First defined, non-null field among the aliases. */
function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function resolveIndex(n: number, count: number): number | null {
  if (!Number.isInteger(n)) return null;
  if (n >= 0 && n < count) return n; // 0-based first
  if (n >= 1 && n <= count) return n - 1; // then 1-based
  return null;
}

/** Resolves one answer against the option list. Accepts option text
 *  (case-insensitive), 0-based index, 1-based index, or a letter a–h.
 *  Returns the canonical option text, or null when nothing matches. */
export function resolveAnswer(raw: unknown, options: string[]): string | null {
  if (typeof raw === "number") {
    const asText = String(raw);
    const textMatch = options.find((o) => o.toLowerCase() === asText.toLowerCase());
    if (textMatch !== undefined) return textMatch;
    const index = resolveIndex(raw, options.length);
    return index === null ? null : options[index];
  }

  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const textMatch = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  if (textMatch !== undefined) return textMatch;

  // Letter form: "c", "C", "c)", "C."
  const letter = trimmed.replace(/[).\s]+$/, "");
  if (/^[a-h]$/i.test(letter)) {
    const index = letter.toLowerCase().charCodeAt(0) - 97;
    return index < options.length ? options[index] : null;
  }

  if (/^\d+$/.test(trimmed)) {
    const index = resolveIndex(Number(trimmed), options.length);
    return index === null ? null : options[index];
  }

  return null;
}

type OptionsResult = { options: string[] } | { error: string };

function parseOptions(raw: unknown): OptionsResult {
  if (raw === undefined) return { error: "is missing its options" };
  if (!Array.isArray(raw)) return { error: "options must be a list" };
  if (raw.length < MIN_OPTIONS || raw.length > MAX_OPTIONS) {
    return {
      error: `needs between ${MIN_OPTIONS} and ${MAX_OPTIONS} options (found ${raw.length})`,
    };
  }
  const options: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const text = toText(raw[i]);
    if (text === null) return { error: `option ${i + 1} is empty or not text` };
    options.push(text);
  }
  return { options };
}

type PairsResult = { pairs: { left: string; right: string }[] } | { error: string };

function parsePairs(raw: unknown): PairsResult {
  if (raw === undefined) return { error: "match question is missing its pairs" };
  if (!Array.isArray(raw)) return { error: "pairs must be a list" };
  if (raw.length < MIN_PAIRS || raw.length > MAX_PAIRS) {
    return { error: `needs between ${MIN_PAIRS} and ${MAX_PAIRS} pairs (found ${raw.length})` };
  }
  const pairs: { left: string; right: string }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    let left: string | null = null;
    let right: string | null = null;
    if (isRecord(entry)) {
      left = toText(entry.left);
      right = toText(entry.right);
    } else if (Array.isArray(entry) && entry.length === 2) {
      left = toText(entry[0]);
      right = toText(entry[1]);
    }
    if (left === null || right === null) {
      return { error: `pair ${i + 1} is missing left or right text` };
    }
    pairs.push({ left, right });
  }
  return { pairs };
}

function parseDifficulty(raw: unknown): Difficulty {
  if (typeof raw !== "string") return "medium";
  const value = raw.trim().toLowerCase();
  return value === "easy" || value === "hard" ? value : "medium";
}

function parseExplanation(raw: unknown): string | null {
  return toText(raw);
}

type QuestionResult = { question: ImportedQuestion } | { error: string };

function parseOne(raw: unknown): QuestionResult {
  if (!isRecord(raw)) return { error: "not a question object" };

  const stem = toText(pick(raw, ["question", "stem", "q"]));
  if (stem === null) return { error: "missing question text" };

  const rawPairs = pick(raw, ["pairs", "matches"]);
  const rawAnswers = pick(raw, ["answers"]);
  const rawAnswer = pick(raw, ["answer", "correct", "correctOption", "correctIndex"]);

  let type: "mcq" | "msq" | "match";
  const explicitType = raw.type === undefined || raw.type === null ? null : raw.type;
  if (explicitType !== null) {
    const t = typeof explicitType === "string" ? explicitType.trim().toLowerCase() : "";
    if (t !== "mcq" && t !== "msq" && t !== "match") {
      return { error: `unknown type "${String(explicitType)}"` };
    }
    type = t;
  } else if (rawPairs !== undefined) {
    type = "match";
  } else if (Array.isArray(rawAnswers) || Array.isArray(rawAnswer)) {
    type = "msq";
  } else {
    type = "mcq";
  }

  const explanation = parseExplanation(pick(raw, ["explanation", "solution"]));
  const difficulty = parseDifficulty(raw.difficulty);

  if (type === "match") {
    const parsed = parsePairs(rawPairs);
    if ("error" in parsed) return { error: parsed.error };
    return { question: { type, stem, pairs: parsed.pairs, explanation, difficulty } };
  }

  const parsedOptions = parseOptions(pick(raw, ["options", "choices"]));
  if ("error" in parsedOptions) return { error: parsedOptions.error };
  const { options } = parsedOptions;

  if (type === "mcq") {
    let answerValue = rawAnswer;
    if (answerValue === undefined && Array.isArray(rawAnswers) && rawAnswers.length === 1) {
      answerValue = rawAnswers[0];
    }
    if (Array.isArray(answerValue)) {
      if (answerValue.length === 1) {
        answerValue = answerValue[0];
      } else {
        return { error: 'has multiple answers — use "answers" (MSQ) for select-all questions' };
      }
    }
    if (answerValue === undefined) return { error: "missing an answer" };
    const correct = resolveAnswer(answerValue, options);
    if (correct === null) return { error: "answer doesn't match any option" };
    return { question: { type, stem, options, correct, explanation, difficulty } };
  }

  // msq
  let answersValue: unknown[] | null = null;
  if (Array.isArray(rawAnswers)) answersValue = rawAnswers;
  else if (Array.isArray(rawAnswer)) answersValue = rawAnswer;
  else if (rawAnswers !== undefined) answersValue = [rawAnswers];
  else if (rawAnswer !== undefined) answersValue = [rawAnswer];
  if (answersValue === null || answersValue.length === 0) {
    return { error: "needs at least one correct answer" };
  }

  const correctSet: string[] = [];
  for (const entry of answersValue) {
    const resolved = resolveAnswer(entry, options);
    if (resolved === null) {
      return { error: `answer ${JSON.stringify(entry)} doesn't match any option` };
    }
    if (!correctSet.includes(resolved)) correctSet.push(resolved);
  }

  return { question: { type, stem, options, correct: correctSet, explanation, difficulty } };
}

/** Pure, forgiving parser for the import file. Bad rows are skipped with a
 *  per-question reason; good rows still parse. Never throws on user data. */
export function parseQuestionImport(input: unknown): ImportParseResult {
  let title: string | null = null;
  let language: Language = "en";
  let rawQuestions: unknown = input;

  if (isRecord(input)) {
    const rawTitle = toText(input.title);
    title = rawTitle === null ? null : rawTitle.slice(0, MAX_TITLE_LENGTH).trim();
    if (typeof input.language === "string" && input.language.trim().toLowerCase() === "hi") {
      language = "hi";
    }
    rawQuestions = input.questions;
  }

  if (!Array.isArray(rawQuestions)) {
    return {
      title,
      language,
      questions: [],
      skipped: [
        {
          index: 0,
          reason:
            'file must be a JSON array of questions, or an object with a "questions" list',
        },
      ],
    };
  }

  const skipped: ImportSkip[] = [];
  const questions: ImportedQuestion[] = [];

  const overflow = rawQuestions.length - MAX_QUESTIONS_PER_FILE;
  const usable = overflow > 0 ? rawQuestions.slice(0, MAX_QUESTIONS_PER_FILE) : rawQuestions;
  if (overflow > 0) {
    skipped.push({
      index: 0,
      reason: `file has ${rawQuestions.length} questions; only the first ${MAX_QUESTIONS_PER_FILE} were considered`,
    });
  }

  usable.forEach((raw, i) => {
    const result = parseOne(raw);
    if ("error" in result) {
      skipped.push({ index: i + 1, reason: result.error });
    } else {
      questions.push(result.question);
    }
  });

  return { title, language, questions, skipped };
}
