"use client";

import { Eye, EyeOff, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createBatch,
  deleteBatch,
  setLearnerBatch,
  toggleBatchActive,
} from "@/lib/actions/batches";
import { plural } from "@/lib/utils";

interface Learner {
  id: string;
  name: string;
  email: string;
}

interface BatchData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  learners: Learner[];
  assignmentCount: number;
}

/** The batch a learner sits in, with a move control. Admin-only: assignments
 *  target batches, so letting learners move themselves would let them shed an
 *  assigned paper. */
function LearnerRow({
  learner,
  batches,
  currentBatchId,
  onMoved,
}: {
  learner: Learner;
  batches: BatchData[];
  currentBatchId: string | null;
  onMoved: (message: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onMove(value: string) {
    const next = value === "" ? null : value;
    if (next === currentBatchId) return;
    setBusy(true);
    onMoved(null);
    const result = await setLearnerBatch(learner.id, next);
    setBusy(false);
    if (!result.ok) {
      onMoved(result.error ?? "Couldn't move the learner.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-muted">
        {learner.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{learner.name}</span>
        <span className="block truncate text-xs text-muted">{learner.email}</span>
      </span>
      <Select
        aria-label={`Batch for ${learner.name}`}
        value={currentBatchId ?? ""}
        disabled={busy}
        onChange={(e) => void onMove(e.target.value)}
        className="h-9 w-36 shrink-0 text-xs"
      >
        <option value="">No batch</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function BatchManager({
  batches,
  unassigned,
}: {
  batches: BatchData[];
  unassigned: Learner[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BatchData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const unassignedCount = unassigned.length;

  async function onToggleActive(batch: BatchData) {
    setError(null);
    const result = await toggleBatchActive(batch.id, !batch.isActive);
    if (!result.ok) {
      setError(result.error ?? "Couldn't update the batch.");
      return;
    }
    router.refresh();
  }

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createBatch({ name: name.trim(), description: description.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the batch.");
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
    const result = await deleteBatch(deleteTarget.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete the batch.");
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  const totalLearners = batches.reduce((sum, b) => sum + b.learners.length, 0) + unassignedCount;

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-on-navy">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">
              {batches.length} {plural(batches.length, "batch", "batches")} · {totalLearners}{" "}
              {plural(totalLearners, "learner")}
            </p>
            {unassignedCount > 0 && (
              <p className="text-xs text-muted">
                {unassignedCount} {plural(unassignedCount, "learner")} without a batch
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden /> New batch
        </Button>
      </Card>

      {batches.map((batch) => (
        <Card key={batch.id} className="p-5 transition-shadow hover:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg text-ink">{batch.name}</h2>
                {!batch.isActive && <Badge tone="neutral">Inactive</Badge>}
              </div>
              {batch.description && (
                <p className="mt-1 text-sm text-muted">{batch.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                onClick={() => void onToggleActive(batch)}
                title={batch.isActive ? "Hide from new assignments" : "Make assignable again"}
              >
                {batch.isActive ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </Button>
              <Button variant="dangerOutline" onClick={() => setDeleteTarget(batch)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              {batch.learners.length} {plural(batch.learners.length, "learner")}
            </Badge>
            {batch.assignmentCount > 0 && (
              <Badge>
                {batch.assignmentCount} {plural(batch.assignmentCount, "assignment")}
              </Badge>
            )}
          </div>

          {batch.learners.length > 0 && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-line">
              {batch.learners.map((learner) => (
                <LearnerRow
                  key={learner.id}
                  learner={learner}
                  batches={batches}
                  currentBatchId={batch.id}
                  onMoved={setError}
                />
              ))}
            </div>
          )}
        </Card>
      ))}

      {unassignedCount > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Without a batch</h2>
          <p className="mt-1 text-sm text-muted">
            These learners see only assignments set for everyone. Move them into a batch to
            include them in batch-targeted papers.
          </p>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-line">
            {unassigned.map((learner) => (
              <LearnerRow
                key={learner.id}
                learner={learner}
                batches={batches}
                currentBatchId={null}
                onMoved={setError}
              />
            ))}
          </div>
        </Card>
      )}

      {error && !createOpen && deleteTarget === null && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new batch">
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Batch name" htmlFor="batch-name">
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. BPSC 74 Hindi Batch"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void onCreate();
              }}
            />
          </Field>
          <Field label="Description (optional)" htmlFor="batch-desc">
            <Textarea
              id="batch-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="A short description of this cohort."
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onCreate()} loading={saving} disabled={!name.trim()}>
            Create batch
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this batch?"
      >
        <p className="text-sm leading-relaxed text-muted">
          The {deleteTarget?.learners.length ?? 0}{" "}
          {plural(deleteTarget?.learners.length ?? 0, "learner")} in{" "}
          <span className="font-medium text-ink">
            &ldquo;{deleteTarget?.name}&rdquo;
          </span>{" "}
          will become unassigned. Their test history stays intact.
        </p>
        {(deleteTarget?.assignmentCount ?? 0) > 0 && (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            <span className="font-semibold">
              {deleteTarget?.assignmentCount}{" "}
              {plural(deleteTarget?.assignmentCount ?? 0, "assignment")} target this batch
            </span>{" "}
            and will stop being visible to anyone once it is gone. Retarget them first if
            learners still need to sit those papers.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onDelete()} loading={saving}>
            Delete batch
          </Button>
        </div>
      </Modal>
    </div>
  );
}
