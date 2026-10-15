# Mains question import format

For BPSC Mains descriptive questions. The objective bank uses a different
file — see `question-import-format.md` for that one.

Plain JSON. No OCR, no AI processing on import: what you upload is what gets
stored, so a mistake in the file is a mistake every candidate sees.

## Shape

```json
{
  "paper": "GS1",
  "section": 1,
  "questions": [
    {
      "textEn": "Examine the role of the Permanent Settlement in shaping agrarian relations in Bihar.",
      "textHi": "बिहार में कृषि संबंधों को आकार देने में स्थायी बंदोबस्त की भूमिका का परीक्षण कीजिए।",
      "type": "LONG",
      "marks": 38,
      "directive": "examine",
      "biharAngle": true,
      "topic": "Modern History > Agrarian Structure",
      "year": 2024
    }
  ]
}
```

`paper` and `section` apply to every question in the file. Override either
per question if a file mixes them.

## Fields

| Field | Required | Notes |
|---|---|---|
| `textEn` / `textHi` | at least one | The question exactly as it appeared. Do not paraphrase. Supply both where the paper was bilingual. |
| `type` | yes | `LONG` (38), `SHORT_SUB` (7–8), `SEC3_LONG`, `ESSAY` (100), `CUSTOM`. |
| `marks` | yes | 1–300. |
| `paper` | yes | `GS1`, `GS2` or `ESSAY`. |
| `section` | no | 1–3 for GS papers. Null for Essay. |
| `directive` | no | `examine`, `discuss`, `critically analyse`, `evaluate`, `describe`, `suggest measures`… |
| `biharAngle` | no | `true` **only** when the question explicitly asks about Bihar. Default false. |
| `topic` | no | Path form groups well: `Indian Polity > Panchayati Raj`. |
| `year` | no | Exam year, for PYQ filtering. |
| `modelAnswer` | no | Supply your own and none is generated. |

## The two fields that change the mark most

**`type`** selects the rubric. `LONG` is marked out of 38 split
10/9/5/5/4/3/2 across demand, content, Bihar, evidence, structure,
presentation and conclusion. `SHORT_SUB` uses a three-criterion split, and
`ESSAY` a different eight. Get this wrong and the answer is marked against
the wrong standard entirely.

**`biharAngle`** changes a marking rule, not just a label. When it is true, a
missing Bihar dimension scores 0–1 on that criterion **and** caps `demand` at
half, because part of the question is simply unanswered. When false, Bihar
material still earns credit if the candidate adds it, but its absence is not
punished. Marking a general question as `biharAngle: true` will cost
candidates marks they did not deserve to lose.

**`directive`** is worth filling in for the same reason: 30% of the mark
rides on whether the candidate obeyed it, and "examine" demands a different
answer from "describe". If the question text opens with the verb the importer
reads it automatically; set it manually when the phrasing buries it.

## Word targets

Not a field — derived from `type` and `marks`, following BPSC's convention of
fuller answers than UPSC:

- `LONG` (34+ marks): 400–450 words
- `SHORT_SUB`: 120–150 words
- `ESSAY`: 700–800, up to ~1000 accepted
- Otherwise roughly 11–13 words per mark

An answer under 60% of target has its total capped at 45%, so these matter.

## Hindi

Put Hindi questions in `textHi`. The evaluator writes its feedback in
whichever language the candidate wrote in, and a model answer follows the
language of the question.

## Example file

```json
{
  "paper": "GS2",
  "section": 1,
  "questions": [
    {
      "textEn": "Critically analyse the effectiveness of the Bihar State Disaster Management Authority in flood mitigation.",
      "type": "LONG",
      "marks": 38,
      "directive": "critically analyse",
      "biharAngle": true,
      "topic": "Bihar Governance > Disaster Management",
      "year": 2023
    },
    {
      "textEn": "Write a short note on the Finance Commission.",
      "type": "SHORT_SUB",
      "marks": 8,
      "directive": "write a note",
      "biharAngle": false,
      "topic": "Indian Polity > Fiscal Federalism",
      "year": 2023
    }
  ]
}
```
