"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { deleteSet } from "@/lib/actions/sets";
import { plural } from "@/lib/utils";

interface DeleteSetButtonProps {
  setId: string;
  title: string;
  questionCount: number;
}

export function DeleteSetButton({ setId, title, questionCount }: DeleteSetButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteSet(setId);
    // On success the action redirects and never returns.
    setDeleting(false);
    if (result && !result.ok) setError(result.error ?? "Couldn't delete the set.");
  }

  return (
    <>
      <Button variant="dangerOutline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete set
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setConfirmation("");
          setError(null);
        }}
        title="Delete this set?"
      >
        <p className="text-sm leading-relaxed text-muted">
          Deleting <span className="font-medium text-ink">“{title}”</span> permanently removes
          its {questionCount} {plural(questionCount, "question")}. Test scores stay in history,
          but their questions will no longer be reviewable.
        </p>
        <p className="mt-3 text-sm text-muted">
          Type <span className="font-mono font-semibold text-danger">delete</span> to confirm.
        </p>
        <Input
          className="mt-2"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="delete"
          aria-label="Type delete to confirm"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setConfirmation("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={confirmation.trim().toLowerCase() !== "delete"}
            loading={deleting}
            onClick={() => void onDelete()}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </>
  );
}
