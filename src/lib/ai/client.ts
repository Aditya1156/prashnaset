import "server-only";

import { resolveProvider, type ProviderConfig } from "@/lib/ai/provider";
import { isMatchOptions, type QuestionRow } from "@/lib/types";

/** Server-only AI client.
 *
 *  Keys are read from the environment and must never carry a NEXT_PUBLIC_
 *  prefix — that would put them in the browser bundle for anyone to take.
 *
 *  Two wire formats are supported: Gemini's own, and the /chat/completions
 *  shape that Groq, OpenRouter, Mistral, Cerebras, Together and OpenAI all
 *  share. Which one is used is decided by resolveProvider(). */

export interface AiExplanation {
  explanation: string;
  tip: string;
}

export type AiResult =
  | { ok: true; value: AiExplanation; model: string }
  | { ok: false; error: string };

function currentProvider(): ProviderConfig | null {
  return resolveProvider(process.env as Record<string, string | undefined>);
}

export function isAiConfigured(): boolean {
  return currentProvider() !== null;
}

/** Human-readable description of what is configured, for admin UI. */
export function describeProvider(): string | null {
  const provider = currentProvider();
  return provider ? `${provider.name} Â· ${provider.model}` : null;
}

type ExplainableQuestion = Pick<
  QuestionRow,
  "type" | "stem" | "options" | "correct" | "explanation"
>;

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
For the question given, produce JSON with exactly two string fields:
"explanation": why the correct answer is right, and briefly why the tempting wrong options are wrong. 2-4 sentences, factual and exam-focused. Do not restate the question.
"tip": one memorable exam tip — a mnemonic, a distinguishing fact, or the trap examiners set with this topic. One or two sentences.
Write plain prose with no markdown, no bullet characters and no headings. Be accurate; if a fact is genuinely uncertain, say so rather than inventing specifics. Reply with the JSON object only.`;

/** Pulls {explanation, tip} out of a model reply that may be wrapped in
 *  prose or a fenced code block. */
export function parseAiPayload(text: string): AiExplanation | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as Partial<AiExplanation>;
    const explanation = parsed.explanation?.trim();
    const tip = parsed.tip?.trim();
    if (!explanation || !tip) return null;
    return { explanation: explanation.slice(0, 4000), tip: tip.slice(0, 1000) };
  } catch {
    return null;
  }
}

function httpFailure(status: number, body: string): string {
  let message = `AI provider returned HTTP ${status}`;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const detail =
      typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    if (detail) message += ` — ${detail}`;
    else message += ` — ${body.slice(0, 200)}`;
  } catch {
    message += ` — ${body.slice(0, 200)}`;
  }
  return message;
}

async function callGemini(
  provider: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<AiResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: { "x-goog-api-key": provider.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { explanation: { type: "STRING" }, tip: { type: "STRING" } },
          required: ["explanation", "tip"],
        },
      },
    }),
  });

  const body = await response.text();
  if (!response.ok) return { ok: false, error: httpFailure(response.status, body) };

  try {
    const payload = JSON.parse(body) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: "The AI provider returned an empty response." };
    const value = parseAiPayload(text);
    return value
      ? { ok: true, value, model: provider.model }
      : { ok: false, error: "The reply was missing the explanation or tip." };
  } catch {
    return { ok: false, error: "Couldn't read the provider's reply." };
  }
}

async function callOpenAiCompatible(
  provider: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<AiResult> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.4,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = await response.text();
  if (!response.ok) return { ok: false, error: httpFailure(response.status, body) };

  try {
    const payload = JSON.parse(body) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: "The AI provider returned an empty response." };
    const value = parseAiPayload(text);
    return value
      ? { ok: true, value, model: provider.model }
      : { ok: false, error: "The reply was missing the explanation or tip." };
  } catch {
    return { ok: false, error: "Couldn't read the provider's reply." };
  }
}

/** Asks the configured provider for an explanation and a tip. Returns a typed
 *  failure instead of throwing so callers can show an admin the real reason. */
export async function explainQuestionWithAi(
  question: ExplainableQuestion,
  signal?: AbortSignal,
): Promise<AiResult> {
  const provider = currentProvider();
  if (!provider) {
    return {
      ok: false,
      error:
        "No AI provider is configured. Set one key on the server: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY or TOGETHER_API_KEY.",
    };
  }

  const prompt = describeQuestion(question);
  try {
    return provider.kind === "gemini"
      ? await callGemini(provider, prompt, signal)
      : await callOpenAiCompatible(provider, prompt, signal);
  } catch (cause) {
    return {
      ok: false,
      error: `Couldn't reach ${provider.name}: ${String(cause).slice(0, 200)}`,
    };
  }
}

