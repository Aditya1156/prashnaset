"use client";

import { Target } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createMistakeSession } from "@/lib/actions/sessions";
import { cn, plural } from "@/lib/utils";

/** One-tap retest of recent mistakes. Re-attempting the questions you got
 *  wrong is the highest-yield revision there is, so it gets a first-class
 *  entry point instead of hiding inside the builder. */
export function MistakeDrillCard({
  mistakeCount,
  days,
  className,
}: {
  mistakeCount: number;
  days: number;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await createMistakeSession(days);
    // Success redirects into the runner and never returns.
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  const none = mistakeCount === 0;

  return (
    <Card
      className={cn(
        "flex flex-col justify-between p-5",
        none ? "" : "border-transparent bg-gradient-to-br from-navy to-navy-raised shadow-lg",
        className,
      )}
      data-testid="mistake-drill"
    >
      <div>
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            none ? "bg-raised text-muted" : "bg-accent-fill text-on-accent",
          )}
        >
          <Target className="size-5" aria-hidden />
        </span>
        <h2
          className={cn("mt-4 font-display text-lg", none ? "text-ink" : "text-on-navy")}
        >
          Revise your mistakes
        </h2>
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            none ? "text-muted" : "text-on-navy-muted",
          )}
        >
          {none ? (
            <>
              Nothing missed in the last {days} days. Take a test — anything you get wrong
              is collected here to drill.
            </>
          ) : (
            <>
              <span className="font-semibold text-on-navy">{mistakeCount}</span>{" "}
              {plural(mistakeCount, "question")} you got wrong in the last {days} days.
              Re-answering them is the fastest way to make them stick.
            </>
          )}
        </p>
      </div>
      {!none && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void start()} loading={busy}>
            Drill {Math.min(mistakeCount, 20)} {plural(Math.min(mistakeCount, 20), "question")}
          </Button>
          {error && <p className="mt-2 text-xs text-on-navy-muted">{error}</p>}
        </div>
      )}
    </Card>
  );
}
