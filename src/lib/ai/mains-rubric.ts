/** BPSC Mains rubrics, word targets and score finalisation.
 *
 *  Pure and dependency-free so it can be unit tested and shared with scripts.
 *  Deliberately separate from the prompt text: the prompts tell the model how
 *  to mark, this decides what the mark actually is. A model's arithmetic is
 *  never trusted — see finaliseEvaluation. */

export type MainsType = "LONG" | "SHORT_SUB" | "SEC3_LONG" | "ESSAY" | "CUSTOM";
export type MainsBand = "POOR" | "BELOW_AVG" | "AVERAGE" | "GOOD" | "EXCELLENT";

export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
}

/** Bihar is a scored criterion rather than a passing mention: it is what
 *  separates a BPSC answer from a generic UPSC one, and worth 5 of 38. */
const LONG: RubricCriterion[] = [
  { key: "demand", label: "Addresses demand & directive", max: 10 },
  { key: "content", label: "Content depth & accuracy", max: 9 },
  { key: "bihar", label: "Bihar dimension", max: 5 },
  { key: "evidence", label: "Data, reports, Articles, cases, schemes", max: 5 },
  { key: "structure", label: "Intro–body–conclusion, subheadings", max: 4 },
  { key: "presentation", label: "Diagrams, underlining, word discipline", max: 3 },
  { key: "conclusion", label: "Conclusion / way forward", max: 2 },
];

const SHORT_SUB_8: RubricCriterion[] = [
  { key: "demand", label: "Direct, to-the-point", max: 3 },
  { key: "content", label: "Key facts & keywords", max: 3 },
  { key: "presentation", label: "Crisp intro/close, format", max: 2 },
];

const SHORT_SUB_7: RubricCriterion[] = [
  { key: "demand", label: "Direct, to-the-point", max: 3 },
  { key: "content", label: "Key facts & keywords", max: 2 },
  { key: "presentation", label: "Crisp intro/close, format", max: 2 },
];

const ESSAY: RubricCriterion[] = [
  { key: "intro", label: "Introduction", max: 10 },
  { key: "understanding", label: "Understanding of topic", max: 15 },
  { key: "multidimensional", label: "Multidimensional coverage", max: 25 },
  { key: "examples", label: "Examples & illustrations", max: 15 },
  { key: "coherence", label: "Coherence & flow", max: 15 },
  { key: "originality", label: "Originality & balance", max: 10 },
  { key: "language", label: "Language & grammar", max: 5 },
  { key: "conclusion", label: "Conclusion", max: 5 },
];

export const RUBRICS = { LONG, SHORT_SUB_8, SHORT_SUB_7, ESSAY };

/** The rubric for a question, scaled to whatever marks it carries.
 *  Scaling drift is absorbed by the first criterion so the maxima always sum
 *  to the question's marks exactly — a rubric that sums to 37 of 38 silently
 *  caps every candidate below full marks. */
export function getRubric(type: MainsType, marks: number): RubricCriterion[] {
  if (type === "ESSAY") return ESSAY.map((c) => ({ ...c }));

  if (type === "SHORT_SUB" || marks <= 8) {
    if (marks === 7) return SHORT_SUB_7.map((c) => ({ ...c }));
    if (marks === 8) return SHORT_SUB_8.map((c) => ({ ...c }));
    const content = Math.max(0, Math.floor(marks / 3));
    const presentation = marks >= 3 ? 1 : 0;
    return [
      { ...SHORT_SUB_8[0], max: marks - content - presentation },
      { ...SHORT_SUB_8[1], max: content },
      { ...SHORT_SUB_8[2], max: presentation },
    ].filter((c) => c.max > 0);
  }

  if (marks === 38) return LONG.map((c) => ({ ...c }));

  const scaled = LONG.map((c) => ({
    ...c,
    max: Math.max(1, Math.round((c.max / 38) * marks)),
  }));
  const drift = marks - scaled.reduce((sum, c) => sum + c.max, 0);
  scaled[0].max += drift;
  return scaled;
}

/** BPSC rewards fuller answers than UPSC — roughly 11–13 words per mark. */
export function wordTarget(type: MainsType, marks: number): string {
  if (type === "ESSAY") return "700–800 (up to ~1000 acceptable)";
  if (type === "SHORT_SUB") return "120–150";
  if (marks >= 34) return "400–450";
  return `${Math.round(marks * 11)}–${Math.round(marks * 13)}`;
}

export function bandFor(percent: number): MainsBand {
  if (percent < 28) return "POOR";
  if (percent < 44) return "BELOW_AVG";
  if (percent < 54) return "AVERAGE";
  if (percent < 64) return "GOOD";
  return "EXCELLENT";
}

export interface RawCriterion {
  key: string;
  awarded: number | string;
  comment?: string;
}

export interface FinalCriterion extends RubricCriterion {
  awarded: number;
  comment?: string;
}

export interface FinalisedScore {
  criteria: FinalCriterion[];
  total: number;
  maxMarks: number;
  percent: number;
  band: MainsBand;
}

/** Recomputes the score from the model's per-criterion marks.
 *
 *  The model's own total is discarded. Language models add up wrongly often
 *  enough that a reported total can disagree with its own breakdown, and a
 *  candidate tracking progress against a number that does not match its
 *  parts has no way to tell which is wrong. Unknown criteria are dropped,
 *  each award is clamped to its maximum, and halves are preserved because
 *  the rubric allows them. */
export function finaliseEvaluation(
  rawCriteria: RawCriterion[],
  type: MainsType,
  marks: number,
): FinalisedScore {
  const rubric = getRubric(type, marks);
  const byKey = new Map(rubric.map((c) => [c.key, c]));

  const criteria: FinalCriterion[] = [];
  for (const raw of rawCriteria ?? []) {
    const spec = byKey.get(raw.key);
    if (!spec) continue;
    const parsed = Number(raw.awarded);
    const awarded = Math.min(Math.max(0, Number.isFinite(parsed) ? parsed : 0), spec.max);
    criteria.push({ ...spec, awarded, comment: raw.comment });
    byKey.delete(raw.key);
  }
  // A criterion the model skipped scores zero rather than vanishing, so the
  // total stays out of however many marks the question is actually worth.
  for (const spec of byKey.values()) criteria.push({ ...spec, awarded: 0 });

  const order = new Map(rubric.map((c, i) => [c.key, i]));
  criteria.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

  const total = Math.round(criteria.reduce((sum, c) => sum + c.awarded, 0) * 2) / 2;
  const percent = marks > 0 ? Number(((total / marks) * 100).toFixed(1)) : 0;

  return { criteria, total, maxMarks: marks, percent, band: bandFor(percent) };
}
