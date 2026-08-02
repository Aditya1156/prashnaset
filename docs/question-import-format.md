# JSON question import format

Drop a `.json` file on the **Import** page and its questions become a set
instantly — no OCR, no AI processing. Every set can be tested on its own or
mixed with others, and each question stays editable afterwards.

A downloadable working example ships with the app:
[`/question-import-example.json`](../public/question-import-example.json).

## Shape

```json
{
  "title": "Optional set title (becomes the set name)",
  "language": "en",
  "questions": [ ... ]
}
```

A bare array of questions (no wrapper object) is also accepted.
`language` is `"en"` (default) or `"hi"`.

## Question types

### MCQ — one correct answer

```json
{
  "type": "mcq",
  "question": "…?",
  "options": ["A", "B", "C", "D"],
  "answer": "C",
  "explanation": "optional",
  "difficulty": "easy | medium | hard (optional, default medium)"
}
```

`answer` may be the option text (case-insensitive), an index, or a letter
(`"c"`, `"C)"`). Numeric answers resolve as **0-based first**, falling back
to 1-based when out of range — `0` is always the first option, and `4` with
four options means the fourth. `type` may be omitted — a single `answer`
implies MCQ.

### MSQ — select all that apply

```json
{
  "type": "msq",
  "question": "…?",
  "options": ["A", "B", "C", "D", "E"],
  "answers": ["A", "C"]
}
```

`answers` entries may also be indices or letters, in any mix. An `answers`
array — or an array inside `correct` — implies MSQ even without `type`.
Duplicate entries are de-duplicated. There is no partial credit at test
time: the full set must match.

### Match the following

```json
{
  "type": "match",
  "question": "Match each item.",
  "pairs": [
    { "left": "Item 1", "right": "Its match" },
    { "left": "Item 2", "right": "Its match" }
  ]
}
```

2–6 pairs. List the **TRUE** pairs — the right column is shuffled by the
app at import time and reshuffled on every edit, so the stored order never
gives the answer away. `["left", "right"]` tuples are accepted too. A
`pairs` array implies match even without `type`.

## Field aliases (all accepted)

- question text: `question`, `stem`, `q`
- options: `options`, `choices`
- single answer: `answer`, `correct`, `correctOption`, `correctIndex`
- multiple answers: `answers`, or an array in `correct`
- explanation: `explanation`, `solution`
- pairs: `pairs`, `matches`

## Limits

- Maximum file size: **2 MB** (enforced in the browser *and* on the server).
- Options per question: 2–8. Pairs per match question: 2–6.
- Questions per file: 2000 (extra rows are skipped with a note).

## Errors

Rows that can't be understood are skipped with a per-question reason
("Question 3: answer doesn't match any option") shown after the import —
the good rows still land. A file with no usable questions is rejected with
the full reason list. Nothing ever "succeeds" empty.
