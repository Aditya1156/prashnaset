# Mains question import format

For BPSC Mains descriptive questions. The objective bank uses a different
file — see `question-import-format.md` for that one.

Plain JSON. No OCR, no AI processing on import: what you upload is what gets
stored, so a mistake in the file is a mistake every candidate sees.

## Shape

```json
{
  "paper": "gs1",
  "questions": [
    {
      "question": "Examine the role of the Permanent Settlement in shaping agrarian relations in Bihar.",
      "marks": 38,
      "wordLimit": 450,
      "directive": "examine",
      "topic": "Modern History",
      "year": 2024
    }
  ]
}
```

`paper` applies to every question in the file. Override it per question if a
file mixes papers.

## Fields

| Field | Required | Notes |
|---|---|---|
| `question` | yes | The question exactly as it appeared. Do not paraphrase. |
| `marks` | yes | 1–300. BPSC long answers are typically 38; short ones vary by cycle. |
| `wordLimit` | no | 50–2000. Omit only if the paper genuinely stated none. |
| `directive` | no | The verb: `examine`, `discuss`, `critically analyse`, `evaluate`, `comment`. |
| `paper` | yes | One of `gs1`, `gs2`, `essay`, `hindi`, `optional`. |
| `topic` | no | Free text for grouping, e.g. `Bihar Economy`. |
| `year` | no | The exam year, for PYQ filtering. |
| `modelAnswer` | no | Supply your own and no model answer is generated for it. |

## Why `directive` is worth filling in

It is the single field that most changes the mark. The evaluator is told the
directive explicitly rather than left to infer it, because "examine" and
"describe" demand different answers and 30% of the mark rides on which one
the candidate actually did. If the question text begins with the verb, the
importer reads it automatically — set it manually only when the phrasing
buries it.

## Word limits

If you do not know the official limit, leave `wordLimit` out rather than
guessing. The evaluator penalises an answer under 70% of the limit, so an
invented limit produces invented mark deductions.

Commonly used for BPSC, by convention rather than official statement:

- Long answer (38 marks): ~450 words
- Essay: 700–800 words

## Hindi

Put Hindi questions in Hindi. The evaluator answers in the language the
candidate wrote in, and the model answer follows the language of the
question.

## Example file

```json
{
  "paper": "gs2",
  "questions": [
    {
      "question": "Critically analyse the effectiveness of the Bihar State Disaster Management Authority in flood mitigation.",
      "marks": 38,
      "wordLimit": 450,
      "directive": "critically analyse",
      "topic": "Bihar Governance",
      "year": 2023
    },
    {
      "question": "Discuss the constitutional provisions relating to the Finance Commission.",
      "marks": 15,
      "wordLimit": 200,
      "directive": "discuss",
      "topic": "Indian Polity",
      "year": 2023
    }
  ]
}
```
