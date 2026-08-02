import { Check, X } from "lucide-react";
import { isMatchOptions, type QuestionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnswerDisplayProps {
  question: Pick<QuestionRow, "type" | "options" | "correct">;
  /** The user's stored selection (review mode). Omit on set pages. */
  userSelected?: unknown;
  showUser?: boolean;
}

/** Static rendering of a question's options with the correct answer
 *  highlighted, and optionally the user's picks marked. Used on the set
 *  detail page and in review mode. */
export function AnswerDisplay({ question, userSelected, showUser = false }: AnswerDisplayProps) {
  if (question.type === "match") {
    if (!isMatchOptions(question.options) || !Array.isArray(question.correct)) return null;
    const correct = question.correct;
    const chosen: (string | null)[] = Array.isArray(userSelected)
      ? (userSelected as (string | null)[])
      : [];

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted uppercase">
              <th className="pr-4 font-medium">Item</th>
              {showUser && <th className="pr-4 font-medium">Your answer</th>}
              <th className="font-medium">{showUser ? "Correct answer" : "Match"}</th>
            </tr>
          </thead>
          <tbody>
            {question.options.left.map((left, i) => {
              const userValue = chosen[i] ?? null;
              const isRight = userValue !== null && userValue === correct[i];
              return (
                <tr key={`${left}-${i}`}>
                  <td className="rounded-l-lg bg-raised px-3 py-2 font-medium text-ink">
                    {left}
                  </td>
                  {showUser && (
                    <td
                      className={cn(
                        "bg-raised px-3 py-2",
                        isRight ? "text-success" : "text-danger",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isRight ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          <X className="size-3.5" aria-hidden />
                        )}
                        {userValue ?? "—"}
                      </span>
                    </td>
                  )}
                  <td className="rounded-r-lg bg-raised px-3 py-2 text-ink">{correct[i]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (!Array.isArray(question.options)) return null;
  const correctValues = Array.isArray(question.correct)
    ? question.correct
    : [question.correct];
  const chosenValues: string[] = showUser
    ? Array.isArray(userSelected)
      ? (userSelected as string[])
      : typeof userSelected === "string"
        ? [userSelected]
        : []
    : [];

  return (
    <ul className="space-y-1.5 text-sm">
      {question.options.map((option, i) => {
        const isCorrect = correctValues.includes(option);
        const isChosen = chosenValues.includes(option);
        return (
          <li
            key={`${option}-${i}`}
            data-correct={isCorrect || undefined}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
              isCorrect
                ? "border-success/40 bg-success-soft font-medium text-ink"
                : isChosen
                  ? "border-danger/40 bg-danger-soft text-ink"
                  : "border-line text-muted",
            )}
          >
            <span className="min-w-0 break-words">{option}</span>
            <span className="flex shrink-0 items-center gap-2">
              {showUser && isChosen && (
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-wide uppercase",
                    isCorrect ? "text-success" : "text-danger",
                  )}
                >
                  your pick
                </span>
              )}
              {isCorrect ? (
                <Check className="size-4 text-success" aria-hidden />
              ) : isChosen ? (
                <X className="size-4 text-danger" aria-hidden />
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
