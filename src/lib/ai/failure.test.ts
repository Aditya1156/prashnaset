import { describe, expect, it } from "vitest";
import { isAccountLevelFailure, isTransientFailure } from "./failure";

describe("isTransientFailure", () => {
  it("treats throttling and server errors as retryable", () => {
    expect(isTransientFailure("AI provider returned HTTP 429 — rate limit reached")).toBe(true);
    expect(isTransientFailure("AI provider returned HTTP 503 — overloaded")).toBe(true);
    expect(isTransientFailure("Couldn't reach Groq: fetch failed")).toBe(true);
  });

  it("does not treat auth or billing problems as retryable", () => {
    expect(isTransientFailure("HTTP 401 — invalid api key")).toBe(false);
    expect(isTransientFailure("dunning decision is deny")).toBe(false);
  });
});

describe("isAccountLevelFailure", () => {
  it("stops a batch on Google's billing block", () => {
    // The exact message returned for a project with unpaid billing.
    expect(
      isAccountLevelFailure(
        "Gemini returned HTTP 403 — Lightning dunning decision is deny for project: projects/98588757721",
      ),
    ).toBe(true);
  });

  it("stops on key, permission and auth problems", () => {
    expect(isAccountLevelFailure("GEMINI_API_KEY is not set on the server.")).toBe(true);
    expect(isAccountLevelFailure("PERMISSION_DENIED")).toBe(true);
    expect(isAccountLevelFailure("API key not valid")).toBe(true);
    expect(isAccountLevelFailure("HTTP 401 — unauthenticated")).toBe(true);
  });

  it("does NOT abandon a run for per-minute throttling", () => {
    // A 429 often means "30 requests per minute", which clears in seconds —
    // abandoning 300 questions over it is the wrong call.
    expect(isAccountLevelFailure("AI provider returned HTTP 429 — rate limit reached")).toBe(
      false,
    );
    expect(isAccountLevelFailure("HTTP 503 — service overloaded")).toBe(false);
  });

  it("keeps going for failures specific to one question", () => {
    expect(isAccountLevelFailure("Gemini returned an empty response.")).toBe(false);
    expect(isAccountLevelFailure("Couldn't read Gemini's reply.")).toBe(false);
    expect(isAccountLevelFailure("Gemini's reply was missing the explanation or tip.")).toBe(
      false,
    );
    expect(isAccountLevelFailure("Gemini returned HTTP 500 — internal error")).toBe(false);
  });
});
