"use client";

import { FolderInput, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createFolder,
  deleteFolder,
  moveSet,
  updateFolder,
} from "@/lib/actions/folders";
import {
  FOLDER_COLOR_NAMES,
  FOLDER_COLORS,
  FOLDER_ICON_NAMES,
  FOLDER_ICONS,
  folderColorStyle,
  type FolderColor,
  type FolderIcon,
} from "@/lib/folder-style";
import { cn, plural } from "@/lib/utils";

export interface FolderOption {
  id: string;
  name: string;
}

function FolderStyleFields({
  color,
  icon,
  onColor,
  onIcon,
}: {
  color: FolderColor;
  icon: FolderIcon;
  onColor: (value: FolderColor) => void;
  onIcon: (value: FolderIcon) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {FOLDER_COLOR_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={`Colour ${name}`}
              aria-pressed={color === name}
              onClick={() => onColor(name)}
              className={cn(
                "size-7 rounded-full transition-transform hover:scale-110",
                FOLDER_COLORS[name].swatch,
                color === name &&
                  "ring-2 ring-ink/60 ring-offset-2 ring-offset-surface scale-110",
              )}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex flex-wrap gap-2">
          {FOLDER_ICON_NAMES.map((name) => {
            const Icon = FOLDER_ICONS[name];
            const selected = icon === name;
            return (
              <button
                key={name}
                type="button"
                aria-label={`Icon ${name}`}
                aria-pressed={selected}
                onClick={() => onIcon(name)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border transition-colors",
                  selected
                    ? cn("border-transparent", folderColorStyle(color).tile)
                    : "border-line text-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function CreateFolderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor>("indigo");
  const [icon, setIcon] = useState<FolderIcon>("folder");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createFolder({ name, color, icon });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the folder.");
      return;
    }
    setOpen(false);
    setName("");
    setColor("indigo");
    setIcon("folder");
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FolderPlus className="size-4" aria-hidden /> New folder
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New folder">
        <div className="space-y-4">
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
          <FolderStyleFields color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
        </div>
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

/** Edit + delete controls shown on a folder's own page. */
export function FolderPageControls({
  folder,
  setCount,
}: {
  folder: { id: string; name: string; color: string; icon: string };
  setCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState<FolderColor>(
    (FOLDER_COLOR_NAMES as readonly string[]).includes(folder.color)
      ? (folder.color as FolderColor)
      : "indigo",
  );
  const [icon, setIcon] = useState<FolderIcon>(
    (FOLDER_ICON_NAMES as readonly string[]).includes(folder.icon)
      ? (folder.icon as FolderIcon)
      : "folder",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setError(null);
    const result = await updateFolder(folder.id, { name, color, icon });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save the folder.");
      return;
    }
    setEditOpen(false);
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
    router.push("/sets");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setName(folder.name);
          setError(null);
          setEditOpen(true);
        }}
      >
        <Pencil className="size-4" aria-hidden /> Edit folder
      </Button>
      <Button variant="dangerOutline" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete
      </Button>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit folder">
        <div className="space-y-4">
          <Field label="Folder name" htmlFor={`edit-name-${folder.id}`} error={error}>
            <Input
              id={`edit-name-${folder.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </Field>
          <FolderStyleFields color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} loading={busy} disabled={!name.trim()}>
            Save folder
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this folder?">
        <p className="text-sm leading-relaxed text-muted">
          Only the folder <span className="font-medium text-ink">“{folder.name}”</span> is
          deleted.{" "}
          {setCount > 0 ? (
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
    </>
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
