"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { generateAiExplanations } from "@/lib/actions/ai";
import { plural } from "@/lib/utils";

/** Admin-only: fills in AI explanations for questions that lack them.
 *  Runs in batches so a large set can be topped up a chunk at a time, and
 *  reports the real error when the model call fails. */
export function GenerateAiButton({
  setId,
  missingCount,
  batchSize,
  provider,
}: {
  setId: string;
  missingCount: number;
  batchSize: number;
  /** e.g. "Groq · llama-3.3-70b-versatile", or null when unconfigured. */
  provider: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<
    { generated: number; failed: number; failure?: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  if (missingCount === 0) return null;

  const thisRun = Math.min(missingCount, batchSize);

  async function run() {
    setBusy(true);
    setError(null);
    setOutcome(null);
    const result = await generateAiExplanations(setId, batchSize);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setOutcome({
      generated: result.generated ?? 0,
      failed: result.failed ?? 0,
      failure: result.firstFailure,
    });
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" aria-hidden /> AI explanations ({missingCount})
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setOutcome(null);
          setError(null);
        }}
        title="Generate AI explanations"
      >
        <p className="text-sm leading-relaxed text-muted">
          {missingCount} {plural(missingCount, "question")} in this set{" "}
          {missingCount === 1 ? "has" : "have"} no AI explanation yet. Each one gets a short
          explanation of the right answer plus an exam tip, written once and stored — learners
          never wait for it.
        </p>
        <p className="mt-2 text-sm text-muted">
          This run will do up to <span className="font-medium text-ink">{thisRun}</span>.
        </p>
        <p className="mt-2 text-xs text-muted">
          {provider ? (
            <>
              Using <span className="font-medium text-ink">{provider}</span>.
            </>
          ) : (
            <>
              No AI provider is configured on the server. Add one key — Groq, OpenRouter,
              Gemini, Mistral, Cerebras or Together — and this will start working.
            </>
          )}
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {outcome && (
          <div className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-sm">
            <p className="text-ink">
              Generated <span className="font-medium">{outcome.generated}</span>
              {outcome.failed > 0 && <> · {outcome.failed} failed</>}.
            </p>
            {outcome.failure && (
              <p className="mt-1 text-xs text-danger">First failure: {outcome.failure}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => void run()} loading={busy}>
            <Sparkles className="size-4" aria-hidden />
            {outcome ? "Run again" : `Generate ${thisRun}`}
          </Button>
        </div>
      </Modal>
    </>
  );
}
