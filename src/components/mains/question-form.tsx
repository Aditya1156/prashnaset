"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/input";

export interface QuestionFormValue {
  paper: "GS1" | "GS2" | "ESSAY";
  section: number | null;
  type: "LONG" | "SHORT_SUB" | "SEC3_LONG" | "ESSAY" | "CUSTOM";
  marks: number;
  wordLimit: number | null;
  textEn: string;
  textHi: string;
  directive: string;
  biharAngle: boolean;
  topic: string;
  examLabel: string;
  examYear: number | null;
}

/** Marks and word target that go with each type, so picking a type fills in
 *  the BPSC defaults rather than leaving an admin to remember them. */
const TYPE_DEFAULTS: Record<QuestionFormValue["type"], { marks: number; words: number }> = {
  LONG: { marks: 38, words: 450 },
  SHORT_SUB: { marks: 8, words: 150 },
  SEC3_LONG: { marks: 38, words: 400 },
  ESSAY: { marks: 100, words: 800 },
  CUSTOM: { marks: 20, words: 250 },
};

const DIRECTIVES = [
  "",
  "discuss",
  "explain",
  "examine",
  "critically examine",
  "critically analyse",
  "evaluate",
  "analyse",
  "describe",
  "write a note",
  "suggest measures",
  "comment",
];

export function QuestionForm({
  value,
  onChange,
}: {
  value: QuestionFormValue;
  onChange: (next: QuestionFormValue) => void;
}) {
  const set = <K extends keyof QuestionFormValue>(key: K, v: QuestionFormValue[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paper" htmlFor="q-paper">
          <Select
            id="q-paper"
            value={value.paper}
            onChange={(e) => {
              const paper = e.target.value as QuestionFormValue["paper"];
              onChange({
                ...value,
                paper,
                section: paper === "ESSAY" ? null : (value.section ?? 1),
                type: paper === "ESSAY" ? "ESSAY" : value.type,
                marks: paper === "ESSAY" ? 100 : value.marks,
              });
            }}
          >
            <option value="GS1">GS Paper I</option>
            <option value="GS2">GS Paper II</option>
            <option value="ESSAY">Essay</option>
          </Select>
        </Field>

        <Field label="Section" htmlFor="q-section">
          <Select
            id="q-section"
            value={value.section === null ? "" : String(value.section)}
            disabled={value.paper === "ESSAY"}
            onChange={(e) => set("section", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">—</option>
            <option value="1">Section 1</option>
            <option value="2">Section 2</option>
            <option value="3">Section 3</option>
          </Select>
        </Field>

        <Field label="Type" htmlFor="q-type" hint="Decides which rubric marks it">
          <Select
            id="q-type"
            value={value.type}
            onChange={(e) => {
              const type = e.target.value as QuestionFormValue["type"];
              const d = TYPE_DEFAULTS[type];
              onChange({ ...value, type, marks: d.marks, wordLimit: d.words });
            }}
          >
            <option value="LONG">Long answer (38)</option>
            <option value="SHORT_SUB">Short sub-part (7–8)</option>
            <option value="SEC3_LONG">Section 3 long</option>
            <option value="ESSAY">Essay (100)</option>
            <option value="CUSTOM">Custom</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marks" htmlFor="q-marks">
          <Input
            id="q-marks"
            type="number"
            min={1}
            max={300}
            value={value.marks}
            onChange={(e) => set("marks", Number(e.target.value))}
          />
        </Field>
        <Field label="Word target" htmlFor="q-words" hint="Leave blank if unknown">
          <Input
            id="q-words"
            type="number"
            min={50}
            max={2000}
            value={value.wordLimit ?? ""}
            onChange={(e) => set("wordLimit", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Directive" htmlFor="q-directive" hint="30% of the mark rides on it">
          <Select
            id="q-directive"
            value={value.directive}
            onChange={(e) => set("directive", e.target.value)}
          >
            {DIRECTIVES.map((d) => (
              <option key={d} value={d}>
                {d || "— infer from text —"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Question (English)" htmlFor="q-en">
        <Textarea
          id="q-en"
          rows={3}
          value={value.textEn}
          onChange={(e) => set("textEn", e.target.value)}
          placeholder="Paste the question exactly as it appeared."
        />
      </Field>

      <Field label="Question (Hindi)" htmlFor="q-hi" hint="BPSC papers are bilingual">
        <Textarea
          id="q-hi"
          rows={3}
          value={value.textHi}
          onChange={(e) => set("textHi", e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Topic" htmlFor="q-topic">
          <Input
            id="q-topic"
            value={value.topic}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="Indian Polity > Panchayati Raj"
          />
        </Field>
        <Field label="Exam" htmlFor="q-exam">
          <Input
            id="q-exam"
            value={value.examLabel}
            onChange={(e) => set("examLabel", e.target.value)}
            placeholder="70th BPSC"
          />
        </Field>
        <Field label="Year" htmlFor="q-year">
          <Input
            id="q-year"
            type="number"
            min={1990}
            max={2100}
            value={value.examYear ?? ""}
            onChange={(e) => set("examYear", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-line bg-raised/40 p-3">
        <input
          type="checkbox"
          checked={value.biharAngle}
          onChange={(e) => set("biharAngle", e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-sm text-ink">
          The question explicitly asks about Bihar
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            This changes a marking rule, not just a label. When on, a missing Bihar dimension
            scores near zero on that criterion <em>and</em> caps the demand mark at half, because
            part of the question is unanswered. Leave it off for general questions — candidates
            still earn credit for adding Bihar material, but are not punished for its absence.
          </span>
        </span>
      </label>
    </div>
  );
}
