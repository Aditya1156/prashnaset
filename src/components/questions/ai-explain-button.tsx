"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { AiInsight } from "@/components/questions/ai-insight";
import { explainQuestionOnDemand } from "@/lib/actions/ai";
import { cn } from "@/lib/utils";

/** Asks for an AI explanation of one question, when the reader wants one.
 *
 *  Most questions carry an explanation written by whoever curated them; a few
 *  do not. Rather than generating for the whole library up front — slow, and
 *  most of it never read — this generates the one question in front of you,
 *  at the moment you want it. */
export function AiExplainButton({
  questionId,
  className,
}: {
  questionId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ explanation: string; tip: string | null } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    const response = await explainQuestionOnDemand(questionId);
    setBusy(false);
    if (!response.ok || !response.explanation) {
      setError(response.error ?? "Couldn't generate an explanation.");
      return;
    }
    setResult({ explanation: response.explanation, tip: response.tip ?? null });
  }

  if (result) {
    return <AiInsight explanation={result.explanation} tip={result.tip} className={className} />;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy}
        data-testid="ai-explain"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-accent-fill/30 bg-accent-soft/50 px-3.5 py-2",
          "text-xs font-medium text-accent-soft-ink transition-colors hover:bg-accent-soft disabled:opacity-70",
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-3.5" aria-hidden />
        )}
        {busy ? "Writing an explanation…" : "Explain with AI"}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
