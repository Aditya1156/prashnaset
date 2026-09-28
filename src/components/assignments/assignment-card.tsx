"use client";

import { CalendarClock, CheckCircle2, Clock3, Play, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { deleteAssignment } from "@/lib/actions/assignments";
import { startAssignment } from "@/lib/actions/sessions";
import { formatDateTime, plural, scorePercent, scoreTone } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface AssignmentCardData {
  id: string;
  title: string;
  instructions: string | null;
  questionCount: number;
  durationMinutes: number | null;
  dueAt: string | null;
  assignAll: boolean;
  batchName: string | null;
  targetCount: number;
  /** The viewer's own attempt, if any. */
  myAttempt: { sessionId: string; completed: boolean; correct: number; total: number } | null;
  /** Admin view only: how many learners have finished. */
  completedBy?: number;
  /** Decided on the server so the badge can't disagree between render passes. */
  overdue: boolean;
}

const toneMap = { success: "success", warn: "warn", danger: "danger" } as const;

export function AssignmentCard({
  assignment,
  isAdmin,
}: {
  assignment: AssignmentCardData;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const overdue = assignment.overdue && !assignment.myAttempt?.completed;

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startAssignment(assignment.id);
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  async function remove() {
    setBusy(true);
    const result = await deleteAssignment(assignment.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete.");
      return;
    }
    setConfirmDelete(false);
    router.refresh();
  }

  const done = assignment.myAttempt?.completed ?? false;
  const percent = done
    ? scorePercent(assignment.myAttempt!.correct, assignment.myAttempt!.total)
    : null;

  return (
    <Card className="p-5 transition-shadow hover:shadow-sm" data-testid="assignment-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">{assignment.title}</h2>
          {assignment.instructions && (
            <p className="mt-1 text-sm leading-relaxed text-muted">{assignment.instructions}</p>
          )}
        </div>
        {done && percent !== null && (
          <Badge tone={toneMap[scoreTone(percent)]}>{percent}%</Badge>
        )}
        {!done && overdue && <Badge tone="danger">Overdue</Badge>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="accent">
          {assignment.questionCount} {plural(assignment.questionCount, "question")}
        </Badge>
        {assignment.durationMinutes && (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden /> {assignment.durationMinutes} min
          </span>
        )}
        {assignment.dueAt && (
          <span
            className={cn("inline-flex items-center gap-1", overdue && "text-danger")}
          >
            <CalendarClock className="size-3.5" aria-hidden />
            Due {formatDateTime(assignment.dueAt)}
          </span>
        )}
        {isAdmin && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {assignment.assignAll
              ? "Everyone"
              : assignment.batchName
                ? assignment.batchName
                : `${assignment.targetCount} ${plural(assignment.targetCount, "learner")}`}
            {assignment.completedBy !== undefined && ` · ${assignment.completedBy} completed`}
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {done ? (
          <ButtonLink href={`/history/${assignment.myAttempt!.sessionId}`} variant="secondary">
            <CheckCircle2 className="size-4 text-success" aria-hidden /> Review your attempt
          </ButtonLink>
        ) : (
          <Button onClick={() => void start()} loading={busy}>
            <Play className="size-4" aria-hidden />
            {assignment.myAttempt ? "Resume test" : "Start test"}
          </Button>
        )}
        {isAdmin && (
          <Button variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this assignment?"
      >
        <p className="text-sm leading-relaxed text-muted">
          Learners will no longer see{" "}
          <span className="font-medium text-ink">“{assignment.title}”</span>. Attempts
          already made keep their scores in history.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            Delete assignment
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
