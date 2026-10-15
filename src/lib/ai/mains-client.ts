import "server-only";

import { resolveProvider, type ProviderConfig } from "@/lib/ai/provider";
import {
  buildClassifyPrompt,
  buildEvaluatePrompt,
  buildModelAnswerPrompt,
  buildTranscribePrompt,
  type MainsQuestionSpec,
  type PromptPair,
} from "@/lib/ai/mains-prompt";

/** Server-only AI calls for Mains writing practice.
 *
 *  Separate from ./client because these need vision and return their own
 *  JSON shapes, while that file is locked to the objective bank's
 *  explanation/tip contract. */

export type MainsAiResult<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; error: string };

export interface InlineImage {
  /** Raw bytes, base64 encoded without a data: prefix. */
  base64: string;
  mimeType: string;
}

function currentProvider(): ProviderConfig | null {
  return resolveProvider(process.env as Record<string, string | undefined>);
}

const NOT_CONFIGURED =
  "No AI provider is configured on the server. Set GEMINI_API_KEY (vision is required for answer sheets).";

/** Pulls a JSON object out of a reply that may be fenced or prefaced. */
function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function httpFailure(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    return `AI provider returned HTTP ${status}${detail ? ` — ${detail}` : ""}`;
  } catch {
    return `AI provider returned HTTP ${status} — ${body.slice(0, 160)}`;
  }
}

/** One call, optionally carrying page images. Temperature defaults to 0:
 *  marking must be reproducible, or the same answer scores differently on a
 *  re-run and the candidate cannot tell what changed. */
async function callModel<T>(
  prompts: PromptPair,
  images: InlineImage[] = [],
  temperature = 0,
): Promise<MainsAiResult<T>> {
  const provider = currentProvider();
  if (!provider) return { ok: false, error: NOT_CONFIGURED };

  try {
    if (provider.kind === "gemini") {
      const parts: unknown[] = [{ text: prompts.user }];
      for (const img of images) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": provider.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompts.system }] },
            contents: [{ parts }],
            generationConfig: {
              temperature,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      const body = await response.text();
      if (!response.ok) return { ok: false, error: httpFailure(response.status, body) };
      const payload = JSON.parse(body) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { ok: false, error: "The AI provider returned an empty response." };
      const value = parseJson<T>(text);
      return value
        ? { ok: true, value, model: provider.model }
        : { ok: false, error: "The reply was not valid JSON." };
    }

    const content: unknown[] = [{ type: "text", text: prompts.user }];
    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      });
    }
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: images.length ? content : prompts.user },
        ],
      }),
    });
    const body = await response.text();
    if (!response.ok) return { ok: false, error: httpFailure(response.status, body) };
    const payload = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: "The AI provider returned an empty response." };
    const value = parseJson<T>(text);
    return value
      ? { ok: true, value, model: provider.model }
      : { ok: false, error: "The reply was not valid JSON." };
  } catch (cause) {
    return { ok: false, error: `Couldn't reach ${provider.name}: ${String(cause).slice(0, 200)}` };
  }
}

export interface TranscriptResult {
  transcript: string;
  language: "en" | "hi" | "mixed";
  approxWordCount: number;
  illegibleCount: number;
  visualElements: string[];
  legibilityNote: string;
}

/** Reads one page. Deliberately per-page rather than per-submission: a
 *  six-page sheet in one call runs past the serverless budget, and a failure
 *  would lose the whole submission instead of one page. */
export async function transcribePage(
  image: InlineImage,
  pageNumber: number,
): Promise<MainsAiResult<TranscriptResult>> {
  const prompts = buildTranscribePrompt(1);
  return callModel<TranscriptResult>(
    { system: prompts.system, user: `${prompts.user}\n\nThis is page ${pageNumber}.` },
    [image],
  );
}

export interface RawEvaluation {
  demandAnalysis?: string[];
  criteria?: { key: string; awarded: number | string; comment?: string }[];
  band?: string;
  wordCountEstimate?: number;
  directiveFollowed?: boolean;
  biharDimension?: { present: boolean; comment: string };
  strengths?: string[];
  mistakes?: string[];
  missedPoints?: string[];
  suggestedStructure?: string[];
  improvedIntro?: string;
  improvedConclusion?: string;
  diagramSuggestion?: string | null;
  presentationNote?: string;
  nextAction?: string;
}

/** Marks a corrected transcript. The page images ride along so presentation —
 *  underlining, diagrams, spacing — can still be judged from the real sheet. */
export async function evaluateAnswer(args: {
  question: MainsQuestionSpec;
  transcript: string;
  language: "en" | "hi" | "mixed";
  timeTakenSec?: number | null;
  images?: InlineImage[];
}): Promise<MainsAiResult<RawEvaluation>> {
  return callModel<RawEvaluation>(
    buildEvaluatePrompt({
      question: args.question,
      transcript: args.transcript,
      language: args.language,
      timeTakenSec: args.timeTakenSec,
    }),
    args.images ?? [],
  );
}

export interface ModelAnswerResult {
  answer: string;
  wordCount: number;
  demandMap?: { demand: string; coveredIn: string }[];
  keywords?: string[];
  whyThisScoresHigh?: string[];
  factsToVerify?: string[];
}

export async function generateModelAnswer(
  question: MainsQuestionSpec,
  language: "en" | "hi" = "en",
): Promise<MainsAiResult<ModelAnswerResult>> {
  // Slight warmth: a model answer needs fluency, where marking needs
  // reproducibility.
  return callModel<ModelAnswerResult>(buildModelAnswerPrompt({ question, language }), [], 0.4);
}

export interface ClassifyResult {
  paper: string;
  section: number | null;
  type: string;
  marks: number;
  wordTarget?: string;
  directive?: string;
  topic?: string;
  tags?: string[];
  biharAngle: boolean;
  isValidBpscStyle: boolean;
  textHi?: string;
  note?: string;
}

export async function classifyQuestion(
  text: string,
  userMarks?: number | null,
): Promise<MainsAiResult<ClassifyResult>> {
  return callModel<ClassifyResult>(buildClassifyPrompt({ text, userMarks }));
}

export function isMainsAiConfigured(): boolean {
  return currentProvider() !== null;
}
