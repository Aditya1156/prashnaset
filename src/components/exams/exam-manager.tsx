"use client";

import { FileQuestion, FolderOpen, Layers, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createExam, deleteExam } from "@/lib/actions/exams";
import { plural } from "@/lib/utils";

interface ExamCard {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  folderCount: number;
  setCount: number;
  questionCount: number;
}

export function ExamManager({ exams }: { exams: ExamCard[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamCard | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createExam({ name: name.trim(), description: description.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the exam.");
      return;
    }
    setCreateOpen(false);
    setName("");
    setDescription("");
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    const result = await deleteExam(deleteTarget.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete the exam.");
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <p className="text-sm text-muted">
          {exams.length} {plural(exams.length, "exam")} ·{" "}
          {exams.length < 2
            ? "add a second one and the switcher appears for every learner"
            : "learners can switch between these"}
        </p>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="size-4" aria-hidden /> New exam
        </Button>
      </Card>

      {exams.map((exam) => {
        const empty = exam.folderCount === 0 && exam.setCount === 0;
        return (
          <Card key={exam.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-lg text-ink">{exam.name}</h2>
                  {!exam.isActive && <Badge>Inactive</Badge>}
                </div>
                {exam.description && (
                  <p className="mt-1 text-sm text-muted">{exam.description}</p>
                )}
              </div>
              <Button
                variant="dangerOutline"
                onClick={() => {
                  setError(null);
                  setDeleteTarget(exam);
                }}
                className="shrink-0"
                aria-label={`Delete ${exam.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 tabular-nums">
                <FolderOpen className="size-3.5" aria-hidden />
                {exam.folderCount} {plural(exam.folderCount, "folder")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 tabular-nums">
                <Layers className="size-3.5" aria-hidden />
                {exam.setCount} {plural(exam.setCount, "set")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 tabular-nums">
                <FileQuestion className="size-3.5" aria-hidden />
                {exam.questionCount} {plural(exam.questionCount, "question")}
              </span>
              {empty && <span className="text-faint">Empty — import into it to get started</span>}
            </div>
          </Card>
        );
      })}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new exam">
        {error && <ErrorBanner message={error} />}
        <p className="text-sm leading-relaxed text-muted">
          A separate track with its own folders, sets and questions. Learners pick which one
          they are preparing for and see only its library.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Exam name" htmlFor="exam-name">
            <Input
              id="exam-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. UPSC"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void onCreate();
              }}
            />
          </Field>
          <Field label="Description (optional)" htmlFor="exam-desc">
            <Textarea
              id="exam-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="Union Public Service Commission"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onCreate()} loading={saving} disabled={!name.trim()}>
            Create exam
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this exam?"
      >
        {(deleteTarget?.folderCount ?? 0) > 0 || (deleteTarget?.setCount ?? 0) > 0 ? (
          <p className="rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            <span className="font-semibold">
              &ldquo;{deleteTarget?.name}&rdquo; still holds {deleteTarget?.folderCount}{" "}
              {plural(deleteTarget?.folderCount ?? 0, "folder")} and {deleteTarget?.setCount}{" "}
              {plural(deleteTarget?.setCount ?? 0, "set")}.
            </span>{" "}
            Move or delete that content first — an exam is never deleted along with a library.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">&ldquo;{deleteTarget?.name}&rdquo;</span> is
            empty, so nothing is lost. Anyone currently preparing for it falls back to another
            track.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={(deleteTarget?.folderCount ?? 0) > 0 || (deleteTarget?.setCount ?? 0) > 0}
            onClick={() => void onDelete()}
          >
            Delete exam
          </Button>
        </div>
      </Modal>
    </div>
  );
}
