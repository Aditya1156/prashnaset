/** Parser for the Mains PYQ import file.
 *
 *  Pure and dependency-free so it can be unit tested. Tolerant about field
 *  names where there is an obvious synonym, strict about anything that
 *  changes how an answer gets marked — a wrong `type` marks the answer
 *  against the wrong rubric entirely, and a wrong `biharAngle` costs
 *  candidates marks they did not deserve to lose. */

import type { MainsType } from "@/lib/ai/mains-rubric";

export type MainsPaper = "GS1" | "GS2" | "ESSAY";

export interface ParsedMainsQuestion {
  paper: MainsPaper;
  section: number | null;
  type: MainsType;
  marks: number;
  wordLimit: number | null;
  textEn: string | null;
  textHi: string | null;
  directive: string | null;
  biharAngle: boolean;
  topic: string | null;
  tags: string[];
  examLabel: string | null;
  examYear: number | null;
  modelAnswer: string | null;
}

export interface MainsParseResult {
  questions: ParsedMainsQuestion[];
  skipped: { index: number; reason: string }[];
}

const PAPERS: MainsPaper[] = ["GS1", "GS2", "ESSAY"];
const TYPES: MainsType[] = ["LONG", "SHORT_SUB", "SEC3_LONG", "ESSAY", "CUSTOM"];

/** Directive verbs BPSC actually uses, longest first so "critically examine"
 *  wins over "examine". */
const DIRECTIVES = [
  "critically examine",
  "critically analyse",
  "critically analyze",
  "critically evaluate",
  "write short note",
  "write a short note",
  "write a note",
  "suggest measures",
  "examine",
  "evaluate",
  "discuss",
  "describe",
  "analyse",
  "analyze",
  "explain",
  "comment",
  "elucidate",
  "illustrate",
  "justify",
] as const;

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

/** Reads the directive from the question text when it was not supplied.
 *  Worth doing: 30% of the mark rides on whether the candidate obeyed it. */
export function inferDirective(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const directive of DIRECTIVES) {
    if (lower.includes(directive)) return directive;
  }
  return null;
}

/** Infers the type from marks when omitted, following the BPSC pattern:
 *  7-8 marks are the compulsory Q1 sub-parts, 38 the standard long answer,
 *  100 an essay. */
export function inferType(marks: number, paper: MainsPaper): MainsType {
  if (paper === "ESSAY" || marks >= 100) return "ESSAY";
  if (marks <= 8) return "SHORT_SUB";
  if (marks >= 34) return "LONG";
  return "CUSTOM";
}

export function parseMainsFile(raw: string): MainsParseResult | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "That file isn't valid JSON." };
  }

  const root = data as Record<string, unknown>;
  const list = Array.isArray(data)
    ? (data as unknown[])
    : Array.isArray(root?.questions)
      ? (root.questions as unknown[])
      : null;

  if (!list) return { error: "Expected an array of questions, or { questions: [...] }." };
  if (list.length === 0) return { error: "That file has no questions in it." };
  if (list.length > 500) return { error: "Too many questions in one file (max 500)." };

  // File-level defaults, overridable per question.
  const filePaper = str(pick(root, "paper"));
  const fileSection = num(pick(root, "section"));
  const fileExam = str(pick(root, "exam", "examLabel"));
  const fileYear = num(pick(root, "year", "examYear"));

  const questions: ParsedMainsQuestion[] = [];
  const skipped: { index: number; reason: string }[] = [];

  list.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      skipped.push({ index, reason: "Not an object." });
      return;
    }
    const row = entry as Record<string, unknown>;

    const paperRaw = (str(pick(row, "paper")) ?? filePaper ?? "").toUpperCase();
    const paper = PAPERS.find((p) => p === paperRaw);
    if (!paper) {
      skipped.push({ index, reason: `Unknown paper "${paperRaw || "(missing)"}".` });
      return;
    }

    const textEn = str(pick(row, "textEn", "text_en", "question", "text"));
    const textHi = str(pick(row, "textHi", "text_hi", "questionHi"));
    if (!textEn && !textHi) {
      skipped.push({ index, reason: "No question text." });
      return;
    }

    const marks = num(pick(row, "marks"));
    if (marks === null || marks < 1 || marks > 300) {
      skipped.push({ index, reason: `Marks must be 1-300, got "${String(pick(row, "marks"))}".` });
      return;
    }

    const typeRaw = (str(pick(row, "type")) ?? "").toUpperCase();
    const type = TYPES.find((t) => t === typeRaw) ?? inferType(marks, paper);

    const sectionValue = num(pick(row, "section")) ?? fileSection;
    const section =
      paper === "ESSAY" || sectionValue === null
        ? null
        : sectionValue >= 1 && sectionValue <= 3
          ? sectionValue
          : null;

    const wordLimit = num(pick(row, "wordLimit", "word_limit"));
    const year = num(pick(row, "year", "examYear")) ?? fileYear;
    const tagsRaw = pick(row, "tags");
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : [];

    questions.push({
      paper,
      section,
      type,
      marks,
      wordLimit: wordLimit !== null && wordLimit >= 50 && wordLimit <= 2000 ? wordLimit : null,
      textEn,
      textHi,
      directive: str(pick(row, "directive")) ?? inferDirective(textEn ?? textHi),
      // Only an explicit true turns this on. It changes a marking rule, so a
      // loose truthy value must not switch it by accident.
      biharAngle: pick(row, "biharAngle", "bihar_angle", "bihar") === true,
      topic: str(pick(row, "topic")),
      tags,
      examLabel: str(pick(row, "exam", "examLabel")) ?? fileExam,
      examYear: year !== null && year >= 1990 && year <= 2100 ? year : null,
      modelAnswer: str(pick(row, "modelAnswer", "model_answer")),
    });
  });

  if (questions.length === 0) {
    return { error: `No usable questions. First problem: ${skipped[0]?.reason ?? "unknown"}` };
  }
  return { questions, skipped };
}
