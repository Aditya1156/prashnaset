"use client";

import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnswerDisplay } from "@/components/questions/answer-display";
import { EditQuestionModal } from "@/components/sets/edit-question-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { removeQuestion } from "@/lib/actions/sets";
import type { QuestionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeLabels = { mcq: "MCQ", msq: "MSQ", match: "Match" } as const;
const difficultyTones = { easy: "success", medium: "neutral", hard: "warn" } as const;

interface QuestionItemProps {
  question: QuestionRow;
  index: number;
}

export function QuestionItem({ question, index }: QuestionItemProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function onRemove() {
    setRemoving(true);
    setRemoveError(null);
    const result = await removeQuestion(question.id);
    setRemoving(false);
    if (!result.ok) {
      setRemoveError(result.error ?? "Couldn't remove the question.");
      return;
    }
    setRemoveOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-surface" data-testid="question-item">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-raised/50"
      >
        <span className="mt-0.5 font-display text-sm text-faint tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium text-ink", !expanded && "line-clamp-2")}>
            {question.stem}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{typeLabels[question.type]}</Badge>
            <Badge tone={difficultyTones[question.difficulty]}>{question.difficulty}</Badge>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="border-t border-line px-4 py-4 sm:pl-11">
          <AnswerDisplay question={question} />
          {question.explanation && (
            <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm leading-relaxed text-muted">
              <span className="font-medium text-ink">Why: </span>
              {question.explanation}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" aria-hidden /> Edit
            </Button>
            <Button variant="dangerOutline" size="sm" onClick={() => setRemoveOpen(true)}>
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </Button>
          </div>
        </div>
      )}

      {editOpen && (
        <EditQuestionModal
          question={question}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Remove this question?">
        <p className="text-sm leading-relaxed text-muted">
          It disappears from this set and from future tests. Attempts you&apos;ve already made
          keep their history.
        </p>
        {removeError && <p className="mt-2 text-sm text-danger">{removeError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoveOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onRemove()} loading={removing}>
            Remove question
          </Button>
        </div>
      </Modal>
    </div>
  );
}
