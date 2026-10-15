"use client";

import {
  BookOpen,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ModelAnswerPanel } from "@/components/mains/model-answer-panel";
import { QuestionForm, type QuestionFormValue } from "@/components/mains/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  createMainsQuestion,
  deleteMainsQuestion,
  importMainsQuestions,
  updateMainsQuestion,
} from "@/lib/actions/mains";
import { cn, plural } from "@/lib/utils";

export interface ManagedQuestion {
  id: string;
  paper: "GS1" | "GS2" | "ESSAY";
  section: number | null;
  type: "LONG" | "SHORT_SUB" | "SEC3_LONG" | "ESSAY" | "CUSTOM";
  marks: number;
  wordLimit: number | null;
  textEn: string | null;
  textHi: string | null;
  directive: string | null;
  biharAngle: boolean;
  topic: string | null;
  examLabel: string | null;
  examYear: number | null;
  modelAnswer: string | null;
  modelAnswerIsAi: boolean;
}

const EMPTY: QuestionFormValue = {
  paper: "GS1",
  section: 1,
  type: "LONG",
  marks: 38,
  wordLimit: 450,
  textEn: "",
  textHi: "",
  directive: "",
  biharAngle: false,
  topic: "",
  examLabel: "",
  examYear: null,
};

function toFormValue(q: ManagedQuestion): QuestionFormValue {
  return {
    paper: q.paper,
    section: q.section,
    type: q.type,
    marks: q.marks,
    wordLimit: q.wordLimit,
    textEn: q.textEn ?? "",
    textHi: q.textHi ?? "",
    directive: q.directive ?? "",
    biharAngle: q.biharAngle,
    topic: q.topic ?? "",
    examLabel: q.examLabel ?? "",
    examYear: q.examYear,
  };
}

export function MainsManager({
  questions,
  provider,
}: {
  questions: ManagedQuestion[];
  /** What the server actually resolved, so "generate" failing for want of a
   *  key is visible here rather than only at the moment of pressing it. */
  provider: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ManagedQuestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [answerFor, setAnswerFor] = useState<ManagedQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedQuestion | null>(null);
  const [form, setForm] = useState<QuestionFormValue>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? questions.filter(
        (q) =>
          (q.textEn ?? "").toLowerCase().includes(needle) ||
          (q.textHi ?? "").includes(query.trim()) ||
          (q.topic ?? "").toLowerCase().includes(needle),
      )
    : questions;

  const withAnswer = questions.filter((q) => q.modelAnswer).length;

  async function onImport(file: File) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const text = await file.text();
    const result = await importMainsQuestions(text);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!result.ok) {
      setError(result.error ?? "Couldn't import that file.");
      return;
    }
    const skipped = result.skipped?.length ?? 0;
    setNotice(
      `Imported ${result.imported} ${plural(result.imported ?? 0, "question")}` +
        (skipped
          ? ` · ${skipped} skipped — first: ${result.skipped?.[0]?.reason ?? ""}`
          : ""),
    );
    router.refresh();
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    const payload = {
      paper: form.paper,
      section: form.section,
      type: form.type,
      marks: form.marks,
      wordLimit: form.wordLimit,
      textEn: form.textEn.trim() || null,
      textHi: form.textHi.trim() || null,
      directive: form.directive.trim() || null,
      biharAngle: form.biharAngle,
      topic: form.topic.trim() || null,
      examLabel: form.examLabel.trim() || null,
      examYear: form.examYear,
    };
    const result = editing
      ? await updateMainsQuestion(editing.id, payload)
      : await createMainsQuestion(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that question.");
      return;
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    const result = await deleteMainsQuestion(deleteTarget.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete that question.");
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {questions.length} {plural(questions.length, "question")} ·{" "}
            <span className={cn(withAnswer < questions.length && "text-warn")}>
              {withAnswer} with a model answer
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileInput.current?.click()} loading={busy}>
              <Upload className="size-4" aria-hidden /> Import file
            </Button>
            <Button
              onClick={() => {
                setForm(EMPTY);
                setError(null);
                setCreating(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Add question
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
          }}
        />
        <label className="flex h-11 items-center gap-2.5 rounded-lg border border-line-strong bg-background px-3 focus-within:border-accent-fill/50">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions and topics…"
            aria-label="Search mains questions"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-sm"
          />
        </label>
        {notice && (
          <p className="rounded-lg border border-success/40 bg-success-soft px-3.5 py-2.5 text-sm text-ink">
            {notice}
          </p>
        )}
        {error && !creating && !editing && !deleteTarget && (
          <p className="rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-sm text-ink">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">
          File format: <code>docs/mains-import-format.md</code>. Get <code>type</code> and{" "}
          <code>biharAngle</code> right — they decide which rubric marks the answer and whether a
          missing Bihar dimension is penalised.
        </p>
        {provider ? (
          <p className="text-xs text-muted">
            AI: <span className="text-ink">{provider}</span> — generation and marking are live.
          </p>
        ) : (
          <p className="rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-xs leading-relaxed text-ink">
            No AI provider is configured on this deployment. Generating model answers, reading
            answer sheets and marking will all fail until <code>GEMINI_API_KEY</code> is set in
            the hosting environment and the app is redeployed — Vercel only applies an
            environment variable to deployments built after it was added.
          </p>
        )}
      </Card>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">
          {questions.length === 0
            ? "No mains questions yet. Import a file or add one by hand."
            : "No questions match that search."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((q) => (
            <li key={q.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{q.paper}</Badge>
                  {q.section && <Badge>Sec {q.section}</Badge>}
                  <Badge>{q.type}</Badge>
                  <Badge>{q.marks} marks</Badge>
                  {q.biharAngle && (
                    <Badge tone="warn">
                      <MapPin className="size-3" aria-hidden /> Bihar
                    </Badge>
                  )}
                  {q.modelAnswer ? (
                    <Badge tone="success">
                      {q.modelAnswerIsAi ? "AI answer" : "Own answer"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">No answer</Badge>
                  )}
                  {q.examYear && <span className="text-xs text-muted">{q.examYear}</span>}
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-ink">
                  {q.textEn ?? q.textHi}
                </p>
                {q.topic && <p className="mt-1 text-xs text-muted">{q.topic}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setForm(toFormValue(q));
                      setError(null);
                      setEditing(q);
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={q.modelAnswer ? "ghost" : "primary"}
                    onClick={() => {
                      setError(null);
                      setAnswerFor(q);
                    }}
                  >
                    {q.modelAnswer ? (
                      <>
                        <BookOpen className="size-3.5" aria-hidden /> Model answer
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" aria-hidden /> Add model answer
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerOutline"
                    onClick={() => {
                      setError(null);
                      setDeleteTarget(q);
                    }}
                    aria-label="Delete question"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit question" : "Add a question"}
        wide
      >
        <QuestionForm value={form} onChange={setForm} />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCreating(false);
              setEditing(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void onSave()} loading={busy}>
            {editing ? "Save changes" : "Add question"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={answerFor !== null}
        onClose={() => setAnswerFor(null)}
        title="Model answer"
        wide
      >
        {answerFor && (
          <ModelAnswerPanel
            question={answerFor}
            onDone={() => {
              setAnswerFor(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this question?"
      >
        <p className="text-sm leading-relaxed text-muted">
          Any attempts learners have already made on it, and the evaluations attached to them,
          are deleted with it. This cannot be undone.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void onDelete()}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
