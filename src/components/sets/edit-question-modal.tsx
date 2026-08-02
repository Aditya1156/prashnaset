"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { updateQuestion } from "@/lib/actions/sets";
import type { UpdateQuestionInput } from "@/lib/schemas";
import { isMatchOptions, type Difficulty, type QuestionRow } from "@/lib/types";

interface EditQuestionModalProps {
  question: QuestionRow;
  open: boolean;
  onClose: () => void;
}

export function EditQuestionModal({ question, open, onClose }: EditQuestionModalProps) {
  const router = useRouter();
  const [stem, setStem] = useState(question.stem);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [options, setOptions] = useState<string[]>(
    Array.isArray(question.options) ? question.options : [],
  );
  const [correctIndex, setCorrectIndex] = useState<number>(
    Array.isArray(question.options) && typeof question.correct === "string"
      ? Math.max(0, question.options.indexOf(question.correct))
      : 0,
  );
  const [correctIndexes, setCorrectIndexes] = useState<number[]>(
    Array.isArray(question.options) && Array.isArray(question.correct)
      ? question.correct
          .map((value) => (question.options as string[]).indexOf(value))
          .filter((i) => i >= 0)
      : [],
  );
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(
    question.type === "match" && isMatchOptions(question.options) && Array.isArray(question.correct)
      ? question.options.left.map((left, i) => ({
          left,
          right: (question.correct as string[])[i] ?? "",
        }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setCorrectIndex((prev) => (prev === index ? 0 : prev > index ? prev - 1 : prev));
    setCorrectIndexes((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    );
  }

  function updatePair(index: number, side: "left" | "right", value: string) {
    setPairs((prev) => prev.map((pair, i) => (i === index ? { ...pair, [side]: value } : pair)));
  }

  async function onSave() {
    setError(null);

    if (!stem.trim()) {
      setError("The question text can't be empty.");
      return;
    }

    let input: UpdateQuestionInput;
    if (question.type === "match") {
      const cleaned = pairs.map((pair) => ({
        left: pair.left.trim(),
        right: pair.right.trim(),
      }));
      if (cleaned.some((pair) => !pair.left || !pair.right)) {
        setError("Every pair needs both a left and a right value.");
        return;
      }
      input = {
        id: question.id,
        type: "match",
        stem: stem.trim(),
        pairs: cleaned,
        explanation: explanation.trim(),
        difficulty,
      };
    } else {
      const cleaned = options.map((option) => option.trim());
      if (cleaned.some((option) => !option)) {
        setError("Options can't be empty.");
        return;
      }
      if (question.type === "mcq") {
        input = {
          id: question.id,
          type: "mcq",
          stem: stem.trim(),
          options: cleaned,
          correctIndex,
          explanation: explanation.trim(),
          difficulty,
        };
      } else {
        if (correctIndexes.length === 0) {
          setError("Pick at least one correct option.");
          return;
        }
        input = {
          id: question.id,
          type: "msq",
          stem: stem.trim(),
          options: cleaned,
          correctIndexes,
          explanation: explanation.trim(),
          difficulty,
        };
      }
    }

    setSaving(true);
    const result = await updateQuestion(input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save the changes.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit question" wide>
      {error && <ErrorBanner message={error} />}
      <div className="space-y-4">
        <Field label="Question" htmlFor={`stem-${question.id}`}>
          <Textarea
            id={`stem-${question.id}`}
            rows={3}
            value={stem}
            onChange={(e) => setStem(e.target.value)}
          />
        </Field>

        {question.type !== "match" && (
          <div className="space-y-1.5">
            <Label>
              Options{" "}
              <span className="font-normal text-muted">
                — {question.type === "mcq" ? "pick the correct one" : "tick all correct ones"}
              </span>
            </Label>
            <div className="space-y-2">
              {options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  {question.type === "mcq" ? (
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={correctIndex === i}
                      onChange={() => setCorrectIndex(i)}
                      aria-label={`Mark option ${i + 1} correct`}
                      className="size-4 shrink-0 accent-[#4f46e5]"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={correctIndexes.includes(i)}
                      onChange={(e) =>
                        setCorrectIndexes((prev) =>
                          e.target.checked ? [...prev, i] : prev.filter((x) => x !== i),
                        )
                      }
                      aria-label={`Mark option ${i + 1} correct`}
                      className="size-4 shrink-0 accent-[#4f46e5]"
                    />
                  )}
                  <Input
                    value={option}
                    onChange={(e) => updateOption(i, e.target.value)}
                    aria-label={`Option ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    aria-label={`Remove option ${i + 1}`}
                    className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={options.length >= 8}
              onClick={() => setOptions((prev) => [...prev, ""])}
            >
              <Plus className="size-4" aria-hidden /> Add option
            </Button>
          </div>
        )}

        {question.type === "match" && (
          <div className="space-y-1.5">
            <Label>
              Pairs <span className="font-normal text-muted">— list the TRUE matches</span>
            </Label>
            <div className="space-y-2">
              {pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={pair.left}
                    onChange={(e) => updatePair(i, "left", e.target.value)}
                    aria-label={`Pair ${i + 1} left`}
                    placeholder="Left"
                  />
                  <Input
                    value={pair.right}
                    onChange={(e) => updatePair(i, "right", e.target.value)}
                    aria-label={`Pair ${i + 1} right`}
                    placeholder="Right"
                  />
                  <button
                    type="button"
                    onClick={() => setPairs((prev) => prev.filter((_, x) => x !== i))}
                    disabled={pairs.length <= 2}
                    aria-label={`Remove pair ${i + 1}`}
                    className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pairs.length >= 6}
              onClick={() => setPairs((prev) => [...prev, { left: "", right: "" }])}
            >
              <Plus className="size-4" aria-hidden /> Add pair
            </Button>
            <p className="text-xs text-muted">
              The right column shown in tests is reshuffled when you save.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Difficulty" htmlFor={`difficulty-${question.id}`}>
            <Select
              id={`difficulty-${question.id}`}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </Field>
        </div>

        <Field label="Explanation (optional)" htmlFor={`explanation-${question.id}`}>
          <Textarea
            id={`explanation-${question.id}`}
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Shown after the answer is checked."
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void onSave()} loading={saving}>
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
