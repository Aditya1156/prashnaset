"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { updateSet } from "@/lib/actions/sets";
import type { Language } from "@/lib/types";

interface EditSetButtonProps {
  setId: string;
  title: string;
  language: Language;
  /** Icon-only trigger, for dense set rows. */
  compact?: boolean;
}

export function EditSetButton({ setId, title, language, compact = false }: EditSetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftLanguage, setDraftLanguage] = useState<Language>(language);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraftTitle(title);
    setDraftLanguage(language);
    setError(null);
    setOpen(true);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const result = await updateSet({
      id: setId,
      title: draftTitle.trim(),
      language: draftLanguage,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save the set.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const unchanged = draftTitle.trim() === title && draftLanguage === language;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openModal}
          aria-label={`Rename set ${title}`}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      ) : (
        <Button variant="secondary" onClick={openModal}>
          <Pencil className="size-4" aria-hidden /> Rename
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Edit set">
        <div className="space-y-4">
          <Field
            label="Set title"
            htmlFor={`set-title-${setId}`}
            error={error}
            hint="Learners see this name in the library and the test builder."
          >
            <Input
              id={`set-title-${setId}`}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={200}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftTitle.trim() && !unchanged) void onSave();
              }}
            />
          </Field>
          <Field label="Language" htmlFor={`set-language-${setId}`}>
            <Select
              id={`set-language-${setId}`}
              value={draftLanguage}
              onChange={(e) => setDraftLanguage(e.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSave()}
            loading={saving}
            disabled={!draftTitle.trim() || unchanged}
          >
            Save changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
