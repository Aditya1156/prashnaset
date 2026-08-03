/** Which AI service to call, resolved from environment variables.
 *
 *  Kept free of server-only imports so it can be unit tested.
 *
 *  Most providers (Groq, OpenRouter, Mistral, Cerebras, Together, DeepSeek,
 *  OpenAI) speak the same /chat/completions shape, so one adapter covers all
 *  of them and only the base URL and model differ. Gemini has its own shape
 *  and gets a dedicated adapter. */

export type ProviderKind = "gemini" | "openai-compatible";

export interface ProviderConfig {
  kind: ProviderKind;
  name: string;
  apiKey: string;
  model: string;
  /** Only used by the OpenAI-compatible adapter. */
  baseUrl?: string;
}

interface Preset {
  name: string;
  kind: ProviderKind;
  baseUrl?: string;
  defaultModel: string;
  /** Environment variables that may hold this provider's key, in order. */
  keyVars: string[];
}

/** Ordered by preference when AI_PROVIDER is not set explicitly: whichever
 *  key is present wins, so dropping in a single variable is enough. */
export const PRESETS: Record<string, Preset> = {
  gemini: {
    name: "Gemini",
    kind: "gemini",
    // `-latest` rather than a pinned version: pinned ids (gemini-2.0-flash)
    // have their own quota pools and were returning 429 on a key where
    // -latest worked fine.
    defaultModel: "gemini-flash-latest",
    keyVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  },
  groq: {
    name: "Groq",
    kind: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyVars: ["GROQ_API_KEY"],
  },
  openrouter: {
    name: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-chat-v3-0324:free",
    keyVars: ["OPENROUTER_API_KEY"],
  },
  mistral: {
    name: "Mistral",
    kind: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    keyVars: ["MISTRAL_API_KEY"],
  },
  cerebras: {
    name: "Cerebras",
    kind: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    keyVars: ["CEREBRAS_API_KEY"],
  },
  together: {
    name: "Together",
    kind: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    keyVars: ["TOGETHER_API_KEY"],
  },
  openai: {
    name: "OpenAI",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyVars: ["OPENAI_API_KEY"],
  },
};

/** Preference order when auto-detecting. Gemini first only because it is the
 *  one already configured here; the rest follow by how usable their free
 *  tiers are for this workload. */
const AUTO_ORDER = ["gemini", "groq", "openrouter", "cerebras", "mistral", "together", "openai"];

export type Env = Record<string, string | undefined>;

/** Resolves the provider from environment. Returns null when nothing is
 *  configured, so callers can say so plainly instead of guessing. */
export function resolveProvider(env: Env): ProviderConfig | null {
  const requested = env.AI_PROVIDER?.trim().toLowerCase();

  // A fully custom endpoint: any OpenAI-compatible service.
  if (requested === "custom") {
    const apiKey = env.AI_API_KEY?.trim();
    const baseUrl = env.AI_BASE_URL?.trim();
    const model = env.AI_MODEL?.trim();
    if (!apiKey || !baseUrl || !model) return null;
    return { kind: "openai-compatible", name: "Custom", apiKey, model, baseUrl };
  }

  const candidates = requested && PRESETS[requested] ? [requested] : AUTO_ORDER;

  for (const key of candidates) {
    const preset = PRESETS[key];
    if (!preset) continue;
    const apiKey =
      preset.keyVars.map((name) => env[name]?.trim()).find(Boolean) ?? env.AI_API_KEY?.trim();
    if (!apiKey) continue;
    return {
      kind: preset.kind,
      name: preset.name,
      apiKey,
      model: env.AI_MODEL?.trim() || preset.defaultModel,
      baseUrl: env.AI_BASE_URL?.trim() || preset.baseUrl,
    };
  }

  return null;
}
