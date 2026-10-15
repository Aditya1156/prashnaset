"use client";

import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";
import { askAboutQuestion } from "@/lib/actions/ai";
import { cn } from "@/lib/utils";

const MAX_CHARS = 300;

interface Exchange {
  asked: string;
  answer: string;
}

/** Free-text follow-up on a question the learner has just attempted. Opens
 *  closed and calls the model only when asked, so a learner who does not want
 *  it costs nothing. */
export function AskAiBox({ questionId, className }: { questionId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAsk() {
    const asked = draft.trim();
    if (asked.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const result = await askAboutQuestion(questionId, asked);
    setBusy(false);
    if (!result.ok || !result.answer) {
      setError(result.error ?? "Couldn't get an answer.");
      return;
    }
    setHistory((prev) => [...prev, { asked, answer: result.answer! }]);
    setDraft("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="ask-ai-open"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink",
          className,
        )}
      >
        <MessageCircleQuestion className="size-3.5" aria-hidden />
        Ask about this question
      </button>
    );
  }

  return (
    <div className={cn("rounded-xl border border-line bg-surface/70 p-3", className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <MessageCircleQuestion className="size-3.5 text-accent" aria-hidden />
        Ask about this question
      </p>

      {history.length > 0 && (
        <ul className="mt-2.5 space-y-2.5">
          {history.map((item, i) => (
            <li key={i} className="space-y-1">
              <p className="text-xs font-medium text-muted">{item.asked}</p>
              <p className="text-sm leading-relaxed text-ink">{item.answer}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-end gap-2">
        <label className="sr-only" htmlFor={`ask-${questionId}`}>
          Your question
        </label>
        <textarea
          id={`ask-${questionId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onAsk();
            }
          }}
          rows={2}
          placeholder="Why is this one right and not the others?"
          className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:text-sm"
        />
        <button
          type="button"
          onClick={() => void onAsk()}
          disabled={busy || draft.trim().length < 3}
          aria-label="Send question"
          data-testid="ask-ai-send"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-fill text-on-accent transition-opacity disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
        </button>
      </div>

      <p className="mt-1.5 text-[11px] text-faint">
        {draft.length}/{MAX_CHARS} · AI can be wrong — check anything that matters.
      </p>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
