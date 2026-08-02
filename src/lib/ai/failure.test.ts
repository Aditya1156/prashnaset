import { describe, expect, it } from "vitest";
import { isAccountLevelFailure } from "./failure";

describe("isAccountLevelFailure", () => {
  it("stops a batch on Google's billing block", () => {
    // The exact message returned for a project with unpaid billing.
    expect(
      isAccountLevelFailure(
        "Gemini returned HTTP 403 — Lightning dunning decision is deny for project: projects/98588757721",
      ),
    ).toBe(true);
  });

  it("stops on key, quota and auth problems", () => {
    expect(isAccountLevelFailure("GEMINI_API_KEY is not set on the server.")).toBe(true);
    expect(isAccountLevelFailure("Gemini returned HTTP 429 — quota exceeded")).toBe(true);
    expect(isAccountLevelFailure("PERMISSION_DENIED")).toBe(true);
    expect(isAccountLevelFailure("API key not valid")).toBe(true);
    expect(isAccountLevelFailure("HTTP 401 — unauthenticated")).toBe(true);
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
