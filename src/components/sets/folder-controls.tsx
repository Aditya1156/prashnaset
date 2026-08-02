"use client";

import { FolderInput, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createFolder, deleteFolder, moveSet, renameFolder } from "@/lib/actions/folders";
import { plural } from "@/lib/utils";

export interface FolderOption {
  id: string;
  name: string;
}

export function CreateFolderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createFolder(name);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the folder.");
      return;
    }
    setOpen(false);
    setName("");
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FolderPlus className="size-4" aria-hidden /> New folder
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New folder">
        <Field label="Folder name" htmlFor="folder-name" error={error}>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Ancient History"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) void onCreate();
            }}
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onCreate()} loading={saving} disabled={!name.trim()}>
            Create folder
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function FolderActions({
  folder,
  setCount,
}: {
  folder: FolderOption;
  setCount: number;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRename() {
    setBusy(true);
    setError(null);
    const result = await renameFolder(folder.id, name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't rename the folder.");
      return;
    }
    setRenameOpen(false);
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteFolder(folder.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete the folder.");
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => {
          setName(folder.name);
          setError(null);
          setRenameOpen(true);
        }}
        aria-label={`Rename folder ${folder.name}`}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setDeleteOpen(true);
        }}
        aria-label={`Delete folder ${folder.name}`}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-danger"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename folder">
        <Field label="Folder name" htmlFor={`rename-${folder.id}`} error={error}>
          <Input
            id={`rename-${folder.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) void onRename();
            }}
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onRename()} loading={busy} disabled={!name.trim()}>
            Save name
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this folder?">
        <p className="text-sm leading-relaxed text-muted">
          Only the folder <span className="font-medium text-ink">“{folder.name}”</span> is
          deleted. {setCount > 0 ? (
            <>
              Its {setCount} {plural(setCount, "set")} — and every question and score in them —
              stay safe under <span className="font-medium text-ink">Unfiled</span>.
            </>
          ) : (
            "It has no sets in it."
          )}
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onDelete()} loading={busy}>
            Delete folder
          </Button>
        </div>
      </Modal>
    </span>
  );
}

export function MoveSetButton({
  setId,
  setTitle,
  currentFolderId,
  folders,
  compact = false,
}: {
  setId: string;
  setTitle: string;
  currentFolderId: string | null;
  folders: FolderOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(currentFolderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onMove() {
    setBusy(true);
    setError(null);
    const result = await moveSet(setId, target === "" ? null : target);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't move the set.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => {
            setTarget(currentFolderId ?? "");
            setError(null);
            setOpen(true);
          }}
          aria-label={`Move set ${setTitle}`}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <FolderInput className="size-4" aria-hidden />
        </button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setTarget(currentFolderId ?? "");
            setError(null);
            setOpen(true);
          }}
        >
          <FolderInput className="size-4" aria-hidden /> Move
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`Move “${setTitle}”`}>
        {folders.length === 0 ? (
          <p className="text-sm text-muted">
            You have no folders yet — create one from the Sets page first.
          </p>
        ) : (
          <>
            <Field label="Destination" htmlFor={`move-${setId}`} error={error}>
              <Select
                id={`move-${setId}`}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Unfiled (no folder)</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void onMove()}
                loading={busy}
                disabled={target === (currentFolderId ?? "")}
              >
                Move set
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
