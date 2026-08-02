import { ChevronRight, Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { QuestionSetRow } from "@/lib/types";
import { formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Sets" };

export default async function SetsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("question_sets")
    .select("*")
    .order("created_at", { ascending: false });
  const sets = (data ?? []) as QuestionSetRow[];

  return (
    <>
      <PageHeader
        title="Your sets"
        description="One set per imported file. Open a set to inspect, edit or remove questions."
        actions={<ButtonLink href="/import">Import questions</ButtonLink>}
      />

      {sets.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No sets yet"
          body="Import your first JSON file and it becomes a set here — ready to test in one click."
          action={<ButtonLink href="/import">Import your first file</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3" data-testid="sets-list">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                href={`/sets/${set.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-4 transition-colors hover:border-accent-fill/50 sm:px-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg text-ink">{set.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">
                      {set.question_count} {plural(set.question_count, "question")}
                    </Badge>
                    <Badge>{set.language === "hi" ? "Hindi" : "English"}</Badge>
                    <span className="text-xs text-muted">Imported {formatDate(set.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
