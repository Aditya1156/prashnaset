import { describe, expect, it } from "vitest";
import { resolveProvider } from "./provider";

describe("resolveProvider", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveProvider({})).toBeNull();
  });

  it("auto-detects whichever provider key is present", () => {
    const groq = resolveProvider({ GROQ_API_KEY: "gsk_x" });
    expect(groq?.name).toBe("Groq");
    expect(groq?.kind).toBe("openai-compatible");
    expect(groq?.baseUrl).toContain("groq.com");
    expect(groq?.model).toBe("llama-3.3-70b-versatile");

    const openrouter = resolveProvider({ OPENROUTER_API_KEY: "sk-or-x" });
    expect(openrouter?.name).toBe("OpenRouter");
    expect(openrouter?.model).toContain(":free");
  });

  it("prefers Gemini when several keys exist, unless told otherwise", () => {
    const env = { GEMINI_API_KEY: "g", GROQ_API_KEY: "k" };
    expect(resolveProvider(env)?.name).toBe("Gemini");
    expect(resolveProvider({ ...env, AI_PROVIDER: "groq" })?.name).toBe("Groq");
  });

  it("defaults Gemini to a -latest model id", () => {
    // Pinned ids carry separate quota pools and 429'd on a key where
    // -latest worked.
    expect(resolveProvider({ GEMINI_API_KEY: "g" })?.model).toBe("gemini-flash-latest");
  });

  it("honours an explicit provider even when another key is present", () => {
    const config = resolveProvider({ AI_PROVIDER: "mistral", MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" });
    expect(config?.name).toBe("Mistral");
    expect(config?.baseUrl).toContain("mistral.ai");
  });

  it("falls back to the generic AI_API_KEY for a named provider", () => {
    const config = resolveProvider({ AI_PROVIDER: "groq", AI_API_KEY: "shared" });
    expect(config?.apiKey).toBe("shared");
    expect(config?.name).toBe("Groq");
  });

  it("allows overriding the model", () => {
    const config = resolveProvider({ GROQ_API_KEY: "k", AI_MODEL: "llama-3.1-8b-instant" });
    expect(config?.model).toBe("llama-3.1-8b-instant");
  });

  it("supports a fully custom OpenAI-compatible endpoint", () => {
    const config = resolveProvider({
      AI_PROVIDER: "custom",
      AI_API_KEY: "k",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "some-model",
    });
    expect(config).toEqual({
      kind: "openai-compatible",
      name: "Custom",
      apiKey: "k",
      model: "some-model",
      baseUrl: "https://example.test/v1",
    });
  });

  it("returns null for an incomplete custom endpoint rather than half-working", () => {
    expect(resolveProvider({ AI_PROVIDER: "custom", AI_API_KEY: "k" })).toBeNull();
  });
});
