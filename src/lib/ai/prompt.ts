/** The explanation prompt, and how a question is rendered for it.
 *
 *  Deliberately dependency-free: the bulk backfill script imports this file
 *  directly (Node type-stripping) so a one-off data load can never drift from
 *  what the app itself sends. */

export const SYSTEM_PROMPT = `You are a tutor for Indian Public Service Commission exams (UPSC, BPSC, state PSCs). A learner has just answered the question below and can already see which answer is correct.

Return JSON with exactly two string fields and nothing else.

"explanation": 2 to 3 complete sentences, 40 to 70 words. Teach the underlying fact — the date, body, article, cause or definition that makes the answer correct — so the learner could answer a differently worded question on the same point. If one wrong choice is a classic confusion, name it by its TEXT and say what it actually refers to.

"tip": ONE sentence, at most 25 words, carrying information NOT already in the explanation: a mnemonic, a contrast with something examiners pair it with, or the specific trap in this topic.

Hard rules:
- Never refer to choices as "Option 1/2/3" or "the first option". Learners see them shuffled. Use the choice's text.
- Never merely restate the answer. "Kassites were from Mesopotamia" is a useless tip.
- Never begin with "The correct answer is".
- Prefer short sentences. Do not chain clauses with commas.
- Complete every sentence and end it with a full stop. No markdown, no bullets, no line breaks inside a field.
- Be accurate. Say so plainly if a detail is genuinely uncertain.`;

export interface PromptQuestion {
  type: string;
  stem: string;
  options: unknown;
  correct: unknown;
  explanation?: string | null;
}

/** Renders a question as plain text for the model. */
export function describeQuestion(question: PromptQuestion): string {
  const lines = [`Question type: ${question.type}`, `Question: ${question.stem}`];
  const options = question.options as
    | { left?: unknown; right?: unknown }
    | unknown[]
    | null;

  if (
    options &&
    !Array.isArray(options) &&
    Array.isArray((options as { left?: unknown }).left)
  ) {
    const left = (options as { left: string[] }).left;
    const correct = Array.isArray(question.correct) ? (question.correct as string[]) : [];
    lines.push("Items to match:");
    left.forEach((item, i) => lines.push(`  - ${item} => ${correct[i] ?? "?"}`));
  } else if (Array.isArray(options)) {
    lines.push("Options:");
    for (const option of options) lines.push(`  - ${String(option)}`);
    const correct = Array.isArray(question.correct)
      ? (question.correct as string[]).join("; ")
      : String(question.correct);
    lines.push(`Correct answer: ${correct}`);
  }

  if (question.explanation) {
    lines.push(`Author note: ${question.explanation}`);
  }
  return lines.join("\n");
}
