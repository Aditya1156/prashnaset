"use client";

import { Bookmark, BookmarkCheck, Loader2, NotebookPen } from "lucide-react";
import { useState } from "react";
import { saveNote, toggleBookmark } from "@/lib/actions/study";
import { cn } from "@/lib/utils";

export interface QuestionNote {
  bookmarked: boolean;
  note: string;
}

/** Bookmark and a private note, shown once a question has been graded.
 *  Writing the reason you got something wrong, in your own words, is what
 *  makes the review later worth anything — so the note lives right next to
 *  the verdict rather than on a separate page. */
export function StudyTools({
  questionId,
  initial,
  className,
}: {
  questionId: string;
  initial?: QuestionNote;
  className?: string;
}) {
  const [bookmarked, setBookmarked] = useState(initial?.bookmarked ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [open, setOpen] = useState(Boolean(initial?.note));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBookmark() {
    const next = !bookmarked;
    setBookmarked(next); // optimistic; reverted if the write fails
    setError(null);
    const result = await toggleBookmark(questionId);
    if (!result.ok) {
      setBookmarked(!next);
      setError(result.error ?? "Couldn't save that bookmark.");
    } else if (typeof result.bookmarked === "boolean") {
      setBookmarked(result.bookmarked);
    }
  }

  async function onSaveNote() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const result = await saveNote(questionId, note);
    setSaving(false);
    if (result.ok) setSaved(true);
    else setError(result.error ?? "Couldn't save that note.");
  }

  return (
    <div className={cn("flex flex-wrap items-start gap-2", className)}>
      <button
        type="button"
        onClick={() => void onBookmark()}
        aria-pressed={bookmarked}
        data-testid="bookmark-toggle"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          bookmarked
            ? "border-accent/40 bg-accent-soft text-accent-soft-ink"
            : "border-line-strong bg-surface text-muted hover:text-ink",
        )}
      >
        {bookmarked ? (
          <BookmarkCheck className="size-3.5" aria-hidden />
        ) : (
          <Bookmark className="size-3.5" aria-hidden />
        )}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
      >
        <NotebookPen className="size-3.5" aria-hidden />
        {note.trim() ? "Edit note" : "Add note"}
      </button>

      {open && (
        <div className="w-full">
          <label className="sr-only" htmlFor={`note-${questionId}`}>
            Your note
          </label>
          <textarea
            id={`note-${questionId}`}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={2000}
            placeholder="Why did you miss it? What is the rule to remember?"
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onSaveNote()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-on-navy disabled:opacity-60"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Save note
            </button>
            {saved && <span className="text-xs text-success">Saved</span>}
          </div>
        </div>
      )}
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
