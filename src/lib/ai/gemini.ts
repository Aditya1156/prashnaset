import "server-only";

import { isMatchOptions, type QuestionRow } from "@/lib/types";

/** Server-only Gemini client. The key is read from GEMINI_API_KEY and must
 *  never be exposed with a NEXT_PUBLIC_ prefix — it would end up in the
 *  browser bundle and be usable by anyone. */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface AiExplanation {
  explanation: string;
  tip: string;
}

export type AiResult =
  | { ok: true; value: AiExplanation; model: string }
  | { ok: false; error: string };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type ExplainableQuestion = Pick<
  QuestionRow,
  "type" | "stem" | "options" | "correct" | "explanation"
>;

/** Renders a question as plain text for the prompt. */
function describeQuestion(question: ExplainableQuestion): string {
  const lines = [`Question type: ${question.type}`, `Question: ${question.stem}`];

  if (isMatchOptions(question.options)) {
    lines.push("Items to match:");
    question.options.left.forEach((left, i) => {
      const right = Array.isArray(question.correct) ? question.correct[i] : "?";
      lines.push(`  - ${left} => ${right}`);
    });
  } else if (Array.isArray(question.options)) {
    lines.push("Options:");
    for (const option of question.options) lines.push(`  - ${option}`);
    const correct = Array.isArray(question.correct)
      ? question.correct.join("; ")
      : question.correct;
    lines.push(`Correct answer: ${correct}`);
  }

  if (question.explanation) {
    lines.push(`Existing note from the author: ${question.explanation}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are an experienced tutor for Indian Public Service Commission exams (UPSC, BPSC and state PSCs).
For the question given, produce:
1. "explanation": why the correct answer is right, and briefly why the tempting wrong options are wrong. 2-4 sentences, factual and exam-focused. Do not restate the question.
2. "tip": one memorable exam tip — a mnemonic, a distinguishing fact, or the trap examiners set with this topic. One or two sentences.
Write plain prose with no markdown, no bullet characters and no headings. Be accurate; if a fact is genuinely uncertain, say so rather than inventing specifics.`;

/** Asks Gemini for an explanation and a tip. Returns a typed failure instead
 *  of throwing so callers can report the real reason to an admin. */
export async function explainQuestionWithAi(
  question: ExplainableQuestion,
  signal?: AbortSignal,
): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set on the server." };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: describeQuestion(question) }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              explanation: { type: "STRING" },
              tip: { type: "STRING" },
            },
            required: ["explanation", "tip"],
          },
        },
      }),
    });
  } catch (cause) {
    return { ok: false, error: `Couldn't reach Gemini: ${String(cause).slice(0, 200)}` };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    let message = `Gemini returned HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
      if (parsed.error?.message) message += ` — ${parsed.error.message}`;
    } catch {
      message += ` — ${bodyText.slice(0, 200)}`;
    }
    return { ok: false, error: message };
  }

  try {
    const payload = JSON.parse(bodyText) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: "Gemini returned an empty response." };

    const parsed = JSON.parse(text) as Partial<AiExplanation>;
    const explanation = parsed.explanation?.trim();
    const tip = parsed.tip?.trim();
    if (!explanation || !tip) {
      return { ok: false, error: "Gemini's reply was missing the explanation or tip." };
    }
    return {
      ok: true,
      model: MODEL,
      value: { explanation: explanation.slice(0, 4000), tip: tip.slice(0, 1000) },
    };
  } catch {
    return { ok: false, error: "Couldn't read Gemini's reply." };
  }
}
