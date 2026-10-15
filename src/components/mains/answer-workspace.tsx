"use client";

import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ImagePlus,
  Loader2,
  MapPin,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { EvaluationReport, type EvaluationView } from "@/components/mains/evaluation-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  evaluateAttempt,
  getModelAnswer,
  saveTranscript,
  startAttempt,
  transcribeAttemptPage,
} from "@/lib/actions/mains";
import { cn, plural } from "@/lib/utils";

export interface MainsQuestionView {
  id: string;
  paper: string;
  section: number | null;
  type: string;
  marks: number;
  wordLimit: number | null;
  textEn: string | null;
  textHi: string | null;
  directive: string | null;
  biharAngle: boolean;
  topic: string | null;
  examLabel: string | null;
  examYear: number | null;
  hasModelAnswer: boolean;
  wordingStatus: "original" | "paraphrased";
}

interface AttemptSummary {
  id: string;
  submittedAt: string;
  mode: "study" | "test";
  wordCount: number;
  percent: number | null;
  band: string | null;
  marks: string | null;
}

const MAX_PAGES = 6;
/** Long side in pixels. Vision quality plateaus well before a phone's full
 *  resolution, and an uncompressed photo makes the call slow and expensive. */
const MAX_EDGE = 1600;

interface Page {
  name: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
}

/** Downscales in the browser before anything is uploaded or sent to the
 *  model. A 4MB phone photo becomes a few hundred KB with no loss that
 *  matters for reading handwriting. */
async function compress(file: File): Promise<Page> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't open that image."));
    image.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const out = canvas.toDataURL("image/jpeg", 0.8);
  return {
    name: file.name,
    dataUrl: out,
    base64: out.split(",")[1] ?? "",
    mimeType: "image/jpeg",
  };
}

type Stage = "write" | "transcribing" | "review" | "marking" | "done";

export function AnswerWorkspace({
  question,
  attempts,
}: {
  question: MainsQuestionView;
  attempts: AttemptSummary[];
}) {
  const [mode, setMode] = useState<"study" | "test">("test");
  const [pages, setPages] = useState<Page[]>([]);
  const [stage, setStage] = useState<Stage>("write");
  const [progressNote, setProgressNote] = useState("");
  const [transcript, setTranscript] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [illegible, setIllegible] = useState(0);
  const [language, setLanguage] = useState<"en" | "hi" | "mixed">("en");
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const questionText = question.textEn ?? question.textHi ?? "";
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PAGES - pages.length;
    const chosen = Array.from(files).slice(0, room);
    try {
      const next = await Promise.all(chosen.map(compress));
      setPages((prev) => [...prev, ...next]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't read those images.");
    }
    // Cleared so re-picking the same file fires change again.
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  function movePage(from: number, to: number) {
    if (to < 0 || to >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function onShowModel() {
    setModelBusy(true);
    setError(null);
    const result = await getModelAnswer(question.id);
    setModelBusy(false);
    if (!result.ok || !result.answer) {
      setError(result.error ?? "Couldn't load a model answer.");
      return;
    }
    setModelAnswer(result.answer);
    // Reading it first means the score measures recall, so the attempt stops
    // counting toward tracked marks.
    setMode("study");
  }

  async function onTranscribe() {
    if (pages.length === 0) return;
    setStage("transcribing");
    setError(null);

    const started = await startAttempt(question.id, mode);
    if (!started.ok || !started.attemptId) {
      setError(started.error ?? "Couldn't start that attempt.");
      setStage("write");
      return;
    }

    // One call per page: a six-page sheet in a single request runs past the
    // serverless budget, and a failure there would lose everything.
    const parts: string[] = [];
    let illegibleTotal = 0;
    let detected: "en" | "hi" | "mixed" = "en";

    for (let i = 0; i < pages.length; i++) {
      setProgressNote(`Reading page ${i + 1} of ${pages.length}…`);
      const page = pages[i];
      const result = await transcribeAttemptPage(
        started.attemptId,
        i + 1,
        page.base64,
        page.mimeType,
      );
      if (!result.ok || !result.transcript) {
        setError(`Page ${i + 1}: ${result.error ?? "couldn't be read."}`);
        setStage("write");
        return;
      }
      parts.push(result.transcript);
      illegibleTotal += result.illegibleCount ?? 0;
      if (result.language && result.language !== "en") detected = result.language;
    }

    const joined = parts.join("\n\n");
    setRawTranscript(joined);
    setTranscript(joined);
    setIllegible(illegibleTotal);
    setLanguage(detected);
    setAttemptId(started.attemptId);
    setProgressNote("");
    setStage("review");
  }

  const [attemptId, setAttemptId] = useState<string | null>(null);

  async function onEvaluate() {
    if (!attemptId) return;
    setStage("marking");
    setError(null);

    const saved = await saveTranscript(attemptId, rawTranscript, transcript, {
      illegibleCount: illegible,
      language,
    });
    if (!saved.ok) {
      setError(saved.error ?? "Couldn't save the transcript.");
      setStage("review");
      return;
    }

    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const result = await evaluateAttempt(attemptId, seconds);
    if (!result.ok) {
      setError(result.error ?? "Couldn't mark that answer.");
      setStage("review");
      return;
    }

    setEvaluation({
      total: result.total ?? 0,
      maxMarks: result.maxMarks ?? question.marks,
      percent: result.percent ?? 0,
      band: result.band ?? "AVERAGE",
      evaluationId: result.evaluationId ?? "",
    });
    setStage("done");
  }

  return (
    <div className="space-y-5">
      {/* ── Question ───────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{question.paper}</Badge>
          {question.section && <Badge>Sec {question.section}</Badge>}
          <Badge>{question.marks} marks</Badge>
          {question.directive && <Badge tone="neutral">{question.directive}</Badge>}
          {question.biharAngle && (
            <Badge tone="warn">
              <MapPin className="size-3" aria-hidden /> Bihar angle
            </Badge>
          )}
          {question.examLabel && (
            <span className="text-xs text-muted">
              {question.examLabel}
              {question.examYear ? ` · ${question.examYear}` : ""}
            </span>
          )}
        </div>
        <p className="mt-3 text-base leading-relaxed text-ink">{questionText}</p>
        {question.textHi && question.textEn && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{question.textHi}</p>
        )}
        {question.wordingStatus === "paraphrased" && (
          <p className="mt-3 rounded-lg border border-line bg-raised/50 px-3 py-2 text-xs leading-relaxed text-muted">
            This is a faithful restatement of the question, not the paper&rsquo;s exact wording.
            The directive and every demand are preserved, so practising against it is sound — but
            do not memorise the phrasing.
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {question.wordLimit && <span>Target ~{question.wordLimit} words</span>}
          {question.topic && <span>{question.topic}</span>}
        </p>
      </Card>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-sm text-ink">
          {error}
        </p>
      )}

      {/* ── Stage 1: write and upload ───────────────────── */}
      {stage === "write" && (
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Write it on paper, then photograph it</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Up to {MAX_PAGES} pages. Shoot them one at a time, or pick several already on your
            device. Images are shrunk here before upload, so a slow connection is fine.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => cameraInput.current?.click()}>
              <Camera className="size-4" aria-hidden /> Take photo
            </Button>
            <Button variant="secondary" onClick={() => galleryInput.current?.click()}>
              <ImagePlus className="size-4" aria-hidden /> Choose from device
            </Button>
            {!modelAnswer && (
              <Button variant="ghost" onClick={() => void onShowModel()} loading={modelBusy}>
                <Eye className="size-4" aria-hidden /> Show model answer first
              </Button>
            )}
          </div>

          {/* Two inputs, because one cannot do both jobs. `capture` opens the
              camera directly on a phone, but it also hides the gallery AND
              cancels `multiple` — so a single input with capture meant there
              was no way to upload a saved photo, and pages had to be added
              one at a time. Splitting them gives both paths properly: shoot
              a page, or pick several at once. On desktop `capture` is
              ignored and both open a file dialog, which is harmless. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void onPick(e.target.files)}
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPick(e.target.files)}
          />

          {pages.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {pages.map((p, i) => (
                <li key={`${p.name}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={`Page ${i + 1}`}
                    className="aspect-[3/4] w-full rounded-lg border border-line object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-navy/80 px-1.5 text-[10px] text-on-navy">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPages((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove page ${i + 1}`}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded bg-navy/80 text-on-navy"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                  {/* Order is what the transcript is stitched in, and shots
                      taken one at a time are easy to get out of sequence. */}
                  <span className="absolute inset-x-1 bottom-1 flex justify-between">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => movePage(i, i - 1)}
                      aria-label={`Move page ${i + 1} earlier`}
                      className="grid size-6 place-items-center rounded bg-navy/80 text-on-navy disabled:opacity-30"
                    >
                      <ChevronLeft className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={i === pages.length - 1}
                      onClick={() => movePage(i, i + 1)}
                      aria-label={`Move page ${i + 1} later`}
                      className="grid size-6 place-items-center rounded bg-navy/80 text-on-navy disabled:opacity-30"
                    >
                      <ChevronRight className="size-3" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {mode === "study" && (
            <p className="mt-4 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-xs leading-relaxed text-ink">
              You opened the model answer, so this is a study attempt. It will be marked, but kept
              out of your tracked scores — having read the answer first, the mark would measure
              recall rather than writing.
            </p>
          )}

          <Button
            className="mt-4"
            disabled={pages.length === 0}
            onClick={() => void onTranscribe()}
          >
            Read my answer ({pages.length} {plural(pages.length, "page")})
          </Button>
        </Card>
      )}

      {stage === "transcribing" && (
        <Card className="flex items-center gap-3 p-6">
          <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">{progressNote || "Reading your pages…"}</p>
            <p className="mt-0.5 text-xs text-muted">
              Each page is read separately, so a slow page never loses the rest.
            </p>
          </div>
        </Card>
      )}

      {/* ── Stage 2: correct the transcript ─────────────── */}
      {stage === "review" && (
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Check what was read</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Fix anything misread before marking. You are scored on this text, so a word the reader
            got wrong should never cost you marks.
          </p>
          {illegible > 0 && (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-xs text-ink">
              {illegible} {plural(illegible, "word")} could not be read and are marked{" "}
              <code>[?]</code>. Replace them with what you wrote — they are not counted against you,
              but they are not counted for you either.
            </p>
          )}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={18}
            className="mt-4 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 font-mono text-sm leading-relaxed text-ink focus:border-accent focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            {words} words
            {question.wordLimit
              ? ` · ${Math.round((words / question.wordLimit) * 100)}% of target`
              : ""}
          </p>
          <Button className="mt-4" onClick={() => void onEvaluate()}>
            Confirm and mark
          </Button>
        </Card>
      )}

      {stage === "marking" && (
        <Card className="flex items-center gap-3 p-6">
          <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">Marking against the BPSC rubric…</p>
            <p className="mt-0.5 text-xs text-muted">This takes a few seconds.</p>
          </div>
        </Card>
      )}

      {stage === "done" && evaluation && (
        <EvaluationReport
          evaluation={evaluation}
          mode={mode}
          onRetry={() => {
            setPages([]);
            setTranscript("");
            setEvaluation(null);
            setAttemptId(null);
            setStage("write");
          }}
        />
      )}

      {/* ── Model answer ────────────────────────────────── */}
      {modelAnswer && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <BookOpen className="size-4 text-accent" aria-hidden /> Model answer
          </h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {modelAnswer}
          </div>
          <p className="mt-3 text-xs text-faint">
            AI-written to BPSC format. Verify any figure before memorising it.
          </p>
        </Card>
      )}

      {/* ── Past attempts ───────────────────────────────── */}
      {attempts.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Your attempts</h2>
          <ul className="mt-3 divide-y divide-line">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm text-ink">
                    {new Date(a.submittedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {a.mode === "study" && (
                      <span className="ml-2 text-xs text-muted">(study)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted tabular-nums">
                    <Clock className="size-3" aria-hidden />
                    {a.wordCount} words
                  </span>
                </span>
                {a.marks && (
                  <span
                    className={cn(
                      "shrink-0 font-display text-sm tabular-nums",
                      (a.percent ?? 0) >= 54 ? "text-success" : "text-ink",
                    )}
                  >
                    {a.marks}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
