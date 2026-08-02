"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileJson2,
  RefreshCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { formatSkip, MAX_IMPORT_BYTES, type ImportSkip } from "@/lib/import/parse";
import { cn, plural } from "@/lib/utils";

interface ReadyFile {
  name: string;
  size: number;
  raw: string;
  defaultTitle: string | null;
}

interface ImportSuccess {
  setId: string;
  title: string;
  imported: number;
  skipped: ImportSkip[];
}

type Phase =
  | { name: "idle" }
  | { name: "ready"; file: ReadyFile }
  | { name: "done"; result: ImportSuccess }
  | { name: "error"; message: string; skipped: ImportSkip[] };

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ImportDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function acceptFile(file: File) {
    if (!/\.json$/i.test(file.name)) {
      setPhase({
        name: "error",
        message: `“${file.name}” isn't a .json file. Export your questions as JSON and retry.`,
        skipped: [],
      });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({
        name: "error",
        message: `“${file.name}” is ${formatSize(file.size)} — the limit is 2 MB.`,
        skipped: [],
      });
      return;
    }

    const raw = await file.text();
    let defaultTitle: string | null = null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        typeof (parsed as { title?: unknown }).title === "string"
      ) {
        defaultTitle = ((parsed as { title: string }).title).trim() || null;
      }
    } catch {
      // Server does the authoritative JSON check with a proper message.
    }

    setTitle("");
    setPhase({ name: "ready", file: { name: file.name, size: file.size, raw, defaultTitle } });
  }

  async function runImport(file: ReadyFile) {
    setUploading(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          fileName: file.name,
          raw: file.raw,
        }),
      });
      const payload = (await response.json()) as Partial<ImportSuccess> & {
        error?: string;
        skipped?: ImportSkip[];
      };

      if (!response.ok || payload.setId === undefined || payload.imported === undefined) {
        setPhase({
          name: "error",
          message: payload.error ?? "Import failed for an unknown reason.",
          skipped: payload.skipped ?? [],
        });
        return;
      }

      setPhase({
        name: "done",
        result: {
          setId: payload.setId,
          title: payload.title ?? "Imported set",
          imported: payload.imported,
          skipped: payload.skipped ?? [],
        },
      });
      router.refresh();
    } catch {
      setPhase({
        name: "error",
        message: "Couldn't reach the server. Check your connection and retry.",
        skipped: [],
      });
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setPhase({ name: "idle" });
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (phase.name === "done") {
    const { result } = phase;
    return (
      <Card className="p-5 sm:p-6" data-testid="import-result">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <h2 className="font-display text-xl text-ink">
              {result.imported} {plural(result.imported, "question")} imported
              {result.skipped.length > 0 && (
                <span className="text-muted"> · {result.skipped.length} skipped</span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Saved to <span className="font-medium text-ink">“{result.title}”</span>.
            </p>
          </div>
        </div>

        {result.skipped.length > 0 && (
          <div className="mt-4 rounded-lg border border-warn/30 bg-warn-soft p-3">
            <p className="text-xs font-semibold tracking-wide text-warn uppercase">
              Skipped rows
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink" data-testid="skip-reasons">
              {result.skipped.map((skip, i) => (
                <li key={i}>{formatSkip(skip)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href={`/test/new?set=${result.setId}`}>Test these now</ButtonLink>
          <ButtonLink href={`/sets/${result.setId}`} variant="secondary">
            View set
          </ButtonLink>
          <Button variant="ghost" onClick={reset}>
            <RefreshCcw className="size-4" aria-hidden /> Import another file
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {phase.name === "error" && (
        <Card className="border-danger/30 bg-danger-soft p-4" data-testid="import-error">
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{phase.message}</p>
              {phase.skipped.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted" data-testid="skip-reasons">
                  {phase.skipped.map((skip, i) => (
                    <li key={i}>{formatSkip(skip)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <label
        htmlFor="import-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void acceptFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-accent-fill bg-accent-soft"
            : "border-line-strong hover:border-accent-fill/60 hover:bg-raised/60",
        )}
      >
        <input
          ref={inputRef}
          id="import-file"
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void acceptFile(file);
          }}
        />
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
          <UploadCloud className="size-5" aria-hidden />
        </div>
        <p className="mt-4 font-medium text-ink">
          Drop your <span className="font-semibold">.json</span> file here
        </p>
        <p className="mt-1 text-sm text-muted">or click to browse · up to 2 MB</p>
      </label>

      {phase.name === "ready" && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileJson2 className="size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{phase.file.name}</p>
                <p className="text-xs text-muted">{formatSize(phase.file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Remove file"
              className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4">
            <Field
              label="Set title (optional)"
              htmlFor="set-title"
              hint={
                phase.file.defaultTitle
                  ? `Defaults to the file's title: “${phase.file.defaultTitle}”.`
                  : "Defaults to the file's title, or the file name."
              }
            >
              <Input
                id="set-title"
                value={title}
                placeholder={phase.file.defaultTitle ?? phase.file.name.replace(/\.json$/i, "")}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>

          <Button
            className="mt-4 w-full sm:w-auto"
            loading={uploading}
            onClick={() => void runImport(phase.file)}
          >
            Import questions
          </Button>
        </Card>
      )}
    </div>
  );
}
