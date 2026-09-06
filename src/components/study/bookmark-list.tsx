"use client";

import { BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { StudyTools } from "@/components/study/study-tools";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createBookmarkSession } from "@/lib/actions/sessions";
import { plural } from "@/lib/utils";

export interface BookmarkItem {
  questionId: string;
  stem: string;
  setTitle: string | null;
  note: string;
}

export function BookmarkList({ items }: { items: BookmarkItem[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function drill() {
    setBusy(true);
    setError(null);
    const result = await createBookmarkSession();
    // Success redirects into the runner and never returns.
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BookmarkCheck}
        title="No bookmarks yet"
        body="Bookmark a question while you review an answer and it will collect here, ready to drill."
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="bookmark-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {items.length} bookmarked {plural(items.length, "question")}
        </p>
        <Button onClick={() => void drill()} loading={busy}>
          Drill bookmarks
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {items.map((item) => (
        <Card key={item.questionId} className="p-4">
          {item.setTitle && (
            <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
              {item.setTitle}
            </p>
          )}
          <p className="mt-1 text-sm leading-relaxed text-ink">{item.stem}</p>
          <StudyTools
            questionId={item.questionId}
            initial={{ bookmarked: true, note: item.note }}
            className="mt-3"
          />
        </Card>
      ))}
    </div>
  );
}
