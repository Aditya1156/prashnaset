import { Download } from "lucide-react";
import type { Metadata } from "next";
import { ImportDropzone } from "@/components/import/import-dropzone";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import" };

const formatRules = [
  {
    type: "MCQ",
    rule: "options (2–8) + one answer — as option text, 0-based index, or a letter a–h.",
  },
  { type: "MSQ", rule: "options + answers: a list; each entry resolves like an MCQ answer." },
  { type: "Match", rule: "pairs (2–6) of { left, right } with the TRUE pairs — we shuffle." },
];

export default async function ImportPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session?.isAdmin) redirect("/dashboard");

  const { data: folderData } = await supabase
    .from("folders")
    .select("id, name")
    .order("name", { ascending: true });
  const folders = (folderData ?? []) as { id: string; name: string }[];

  return (
    <>
      <PageHeader
        title="Import questions"
        description="Drop a JSON file converted from your notes. Good rows import instantly; anything unreadable is listed with a reason."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ImportDropzone folders={folders} />

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Format at a glance</h2>
          <ul className="mt-4 space-y-3">
            {formatRules.map((entry) => (
              <li key={entry.type} className="flex items-start gap-2.5 text-sm">
                <Badge tone="accent" className="mt-0.5">
                  {entry.type}
                </Badge>
                <span className="leading-relaxed text-muted">{entry.rule}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            <li>
              Aliases accepted: <code>question|stem|q</code>, <code>options|choices</code>,{" "}
              <code>answer|correct|correctOption|correctIndex</code>, <code>pairs|matches</code>,{" "}
              <code>explanation|solution</code>.
            </li>
            <li>
              <code>type</code> may be omitted — <code>answers[]</code> implies MSQ,{" "}
              <code>pairs[]</code> implies match, else MCQ.
            </li>
            <li>A wrapper object with title/language, or a bare array — both work.</li>
          </ul>
          <ButtonLink
            href="/question-import-example.json"
            variant="secondary"
            size="sm"
            className="mt-4"
            download
          >
            <Download className="size-4" aria-hidden />
            Download example JSON
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}
