"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createBatch, deleteBatch } from "@/lib/actions/batches";
import { plural } from "@/lib/utils";

interface BatchData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  learners: { id: string; name: string; email: string }[];
}

export function BatchManager({
  batches,
  unassignedCount,
}: {
  batches: BatchData[];
  unassignedCount: number;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BatchData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
            <Button
              variant="dangerOutline"
              onClick={() => setDeleteTarget(batch)}
              className="shrink-0"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge tone="accent">
              {batch.learners.length} {plural(batch.learners.length, "learner")}
            </Badge>
          </div>

          {batch.learners.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-line">
              {batch.learners.map((learner) => (
                <div
                  key={learner.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-muted">
                    {learner.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {learner.name}
                    </span>
                    <span className="block truncate text-xs text-muted">{learner.email}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

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
          Learners in{" "}
          <span className="font-medium text-ink">
            &ldquo;{deleteTarget?.name}&rdquo;
          </span>{" "}
          will become unassigned. Their test history stays intact.
        </p>
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
