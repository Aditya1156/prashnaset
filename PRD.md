# PrashnaSet — starter prompt

> **How to use this file:** create a new empty folder, copy this file into it
> as `PRD.md`, open Claude Code in that folder, and say:
> *"Read PRD.md and start with Milestone 0."*
> This document is the complete, self-contained spec — product, stack,
> schema, security, milestones, and working rules.

---

## 1. What this app is

A focused question-bank and test app for exam aspirants. The **entire v1 is
one feature done excellently**: the user brings their own questions as a
JSON file (converted from their PDFs/notes with any tool they like), imports
them in one drop, and can immediately take tests on them, see scores, and
track history. No OCR, no AI generation, no background pipeline — those are
deliberate non-goals for v1 (they exist in a sister project and may be
ported later).

**The core loop:** convert notes → drop JSON → questions ready → take a test
tonight → see the score → retake weak ones.

## 2. Stack (chosen for deployability first)

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript** | One deployable unit for UI + API routes; Vercel-native. |
| Database | **Supabase (Postgres)** | Questions/attempts/sessions are *relational* (joins, counts, per-user scoping). Postgres Row-Level Security ties every row to the signed-in user at the database layer — security you don't have to remember to write per endpoint. Free tier is enough to launch. |
| Auth | **Supabase Auth** (email/password; Google OAuth later) | Integrated with RLS; no custom token handling. |
| Styling | **Tailwind CSS** | Fast, consistent. |
| Validation | **Zod** | One schema validates the import file AND the API payloads. |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | The import parser and grading logic are pure functions — unit-test them hard. |
| Hosting | **Vercel + Supabase Cloud** | Zero servers to manage. `git push` = deploy. |

**Explicitly not MongoDB.** This data is relational to its bones (a session
joins questions joins sets joins users; history is aggregation). Mongo would
buy nothing here and would cost us RLS — the single biggest security win in
the stack. If a document store is ever wanted for something genuinely
unstructured, add it then; don't start there.

**No Python service, no AI keys, no cron, no background workers in v1.**
Everything is a synchronous request. That is what makes this deployable in
an afternoon and free to run.

## 3. Data model (Postgres, all tables RLS'd to the owner)

```sql
-- profiles: mirrors auth.users (id uuid PK references auth.users)
--   display_name text, created_at

-- question_sets: one row per imported JSON file
--   id uuid PK, owner_id uuid -> profiles (not null),
--   title text not null, language text check (en|hi) default 'en',
--   source_file_ref text,          -- the stored original JSON (Supabase storage)
--   question_count int not null default 0,
--   created_at timestamptz

-- questions
--   id uuid PK, set_id uuid -> question_sets on delete cascade,
--   owner_id uuid -> profiles (not null),   -- denormalized for RLS + survival
--   type text check (mcq|msq|match),
--   stem text not null,
--   options jsonb,        -- mcq/msq: string[];  match: {left: string[], right: string[]}
--   correct jsonb,        -- mcq: string; msq: string[]; match: string[] (right per left)
--   explanation text, difficulty text check (easy|medium|hard) default 'medium',
--   status text check (active|removed) default 'active',
--   created_at timestamptz

-- test_sessions
--   id uuid PK, owner_id uuid, label text,
--   question_count int, correct_count int default 0,
--   started_at, completed_at timestamptz

-- session_questions (session_id, question_id, sort_order, PK(session,question))

-- attempts
--   id uuid PK, owner_id, question_id -> questions on delete cascade,
--   session_id -> test_sessions on delete set null,
--   selected jsonb, is_correct boolean, created_at
```

RLS pattern for every table: `owner_id = auth.uid()` for select/insert/
update/delete. No service-role key in any user-facing path. The match
`options.right` column is ALWAYS a code-side shuffle of `correct` — never
trust the file's ordering.

## 4. The import format (proven; keep byte-compatible)

Accept a `.json` file: either `{ "title", "language", "questions": [...] }`
or a bare array. Per question:

- **MCQ**: `{ "type":"mcq", "question":"…", "options":[...2–8], "answer": textOrIndexOrLetter }`
- **MSQ**: `{ "type":"msq", "question":"…", "options":[...], "answers":[...] }`
- **Match**: `{ "type":"match", "question":"…", "pairs":[{"left","right"}] }` (2–6 pairs)

Forgiveness rules (all implemented in a pure `parseQuestionImport()` with
unit tests): aliases `question|stem|q`, `options|choices`,
`answer|correct|correctOption|correctIndex`, `answers|correct[]`,
`explanation|solution`, `pairs|matches`; answers resolve as option text
(case-insensitive), 0-based index, 1-based index, or letter `a–h`; `type`
inferred when omitted (answers[] ⇒ msq, pairs[] ⇒ match, else mcq); bad rows
are **skipped with a per-question reason** ("question 3: answer doesn't
match any option") and good rows still import; a file with zero usable
questions is rejected with the reason list. Max file size 2MB. Show the
skipped reasons in the UI after import.

Ship a downloadable example at `/question-import-example.json` and a format
doc at `docs/question-import-format.md`.

## 5. Screens (v1 complete list — nothing more)

1. **Landing** — one page: what it does, the three-step loop, sign up. No
   fabricated numbers or fake testimonials, ever.
2. **Auth** — sign up (name/email/password/confirm), sign in, password reset.
3. **Dashboard** — real stats only: total questions, sets, tests taken,
   average score; a "Take a test" button; recent sets; empty states that
   tell the user exactly what to do first.
4. **Import** — drag-drop zone for `.json` (+ file picker), title field
   (optional; file's `title` is the default), result panel: "N imported ·
   M skipped (reasons)", then "Test these now".
5. **Sets** — list of imported sets (title, count, date); a set page listing
   its questions expandable to full detail (options with the correct answer
   highlighted, explanation), with edit and remove per question and
   delete-set (typed "delete" confirmation).
6. **Test builder** — scope: everything / one set / multiple sets; count
   (5/10/15/20/25 capped by availability, shown honestly); types filter
   (MCQ/MSQ/Match). Builds a session and starts it.
7. **Test runner** — one question per screen: MCQ radio, MSQ multi-select
   ("select all that apply"), match via per-row dropdowns of a shuffled
   right column; check-answer reveals correct/incorrect states + explanation;
   progress bar; finish screen with score.
8. **History** — every session: label, date, score % (color-coded),
   resumable if unfinished; click through to review answers.

Design language: clean, serif display headings, one accent color, real data
only, honest empty states, light + dark. Mobile-first — students live on
phones.

## 6. Security checklist (verify each at its milestone)

- RLS on every table; e2e test proving user B cannot read/modify user A's
  rows (not just "the UI hides it").
- Import validated server-side with Zod regardless of client checks; size
  limit enforced server-side; JSON.parse in try/catch.
- No service-role key reachable from client code paths.
- Auth pages rate-limit friendly (Supabase defaults) — note middleware
  rate limiting as a fast-follow.
- Typed-confirmation for destructive actions; deletes are owner-scoped.

## 7. Milestones — each ends with a working, verified state

**M0 — Skeleton (half a day):** create-next-app + Tailwind + Supabase local
(`supabase init/start`), schema migration + RLS, auth pages working, deploy
the empty shell to Vercel + Supabase Cloud on day one (deployment is a
feature; do it first, not last).

**M1 — Import (the heart):** `parseQuestionImport` + exhaustive unit tests
(≥10 cases incl. every alias/index form and error rows) → import API →
import screen with result panel → sets list + set detail. *Acceptance: drop
the example file, see 4 questions with correct answers highlighted; a file
with 2 good + 2 bad rows imports 2 and lists 2 reasons.*

**M2 — Testing:** grading module (pure, unit-tested: mcq text equality, msq
set equality no partial credit, match full-mapping equality) → builder →
runner for all three types → finish screen. *Acceptance: e2e answers one of
each type correctly and incorrectly; score matches.*

**M3 — History + dashboard:** sessions list with %, resume, review mode;
dashboard real stats. *Acceptance: numbers on dashboard provably equal DB
aggregates.*

**M4 — Polish + hardening:** question edit/remove, typed deletes, dark mode
pass, mobile pass, the cross-user RLS e2e, empty-state copy, README with
screenshots.

Later (explicitly out of v1): AI question generation from PDFs/photos,
spaced repetition, folders/subjects taxonomy, PWA/offline, payments.

## 8. Working rules for the agent (these are non-negotiable)

1. **No fabricated data, ever.** No demo numbers, placeholder stats, fake
   testimonials, or invented content. Empty states over dummy data.
2. **Verify live, not just by reading code.** Every milestone ends with a
   real browser e2e (Playwright) against the running app and real DB rows —
   screenshots checked, console errors must be zero.
3. **Gate before every commit:** `tsc --noEmit`, eslint, vitest, `next
   build` — all green.
4. **Honest failures:** anything that can't be done (parse error, empty
   file, DB error) fails loudly with a human message; nothing "succeeds"
   empty.
5. Small commits with clear messages; push to GitHub after each milestone.
6. Windows dev environment: avoid `&` in folder names; prefer
   `node node_modules/<pkg>/bin/...` over npx shims when paths break.

## 9. Naming

Working name: **PrashnaSet** (प्रश्न set — "question set"). Pick the final
name/domain before the landing page is written; everything else is
name-agnostic.
