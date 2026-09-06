<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Already-applied v16 conventions in this repo: `src/proxy.ts` (not middleware),
async `cookies()`/`params`/`searchParams`, ESLint CLI directly (no `next lint`),
Turbopack for dev and build.

## Project notes — PrashnaSet

Spec: `PRD.md` (complete product/stack/milestone spec — follow it).
Format doc: `docs/question-import-format.md`.

## Commands

- `npm run dev` — dev server (local Supabase must be up: `npx supabase start`)
- `npm run gate` — typecheck + lint + unit tests + build; must be green before every commit
- `npm run e2e` — Playwright against `next start -p 3011` + local Supabase (build first)
- `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts` — regenerate README screenshots

## Environment

- Local Supabase ports: API 56321, DB 56322, Studio 56323, Mailpit 56334
  (custom block in `supabase/config.toml` — other local projects own 54321/55521).
- Env keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted). Cloud values are in
  the comments of `.env.local`. NEVER introduce the service-role key.
- Schema changes go in `supabase/migrations/` AND regenerate
  `supabase/cloud-setup.sql` (concatenation of migrations).
- NEVER pipe secrets/env values into a CLI via PowerShell's `|` — PS 5.1 can
  inject a BOM/encoding artefact, and a single non-ASCII byte in
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` breaks EVERY browser fetch with
  "String contains non ISO-8859-1 code point" (it is sent as an HTTP header).
  Use `cmd /c 'echo value| npx vercel env add ...'` or the dashboard, then
  verify with `node scripts/prod-pages-check.mjs`.

## Product model (post-v1 pivot, user-directed)

- Content (folders/sets/questions) is shared-read, ADMIN-only-write; activity
  (sessions/attempts) is per-user. `public.is_admin()` powers the policies.
- First signup becomes admin; `adityaissc7@gmail.com` is always promoted.
- Profile updates are column-restricted to display_name (self-promotion is a
  guarded regression — see rls.spec.ts). subscription_* columns are dormant.
- E2E seeds admins via the local demo service key (helpers.ts) and
  global-teardown deletes all @prashnaset.test accounts after each run —
  the shared library would otherwise accumulate visible test debris.

## Study engine (BPSC robustness pass)

- Spaced repetition: `review_state` (Leitner boxes) + `src/lib/review/schedule.ts`
  (pure, unit-tested). `submitAttempt` calls `recordReview` after grading and
  never lets a scheduling failure cost the learner their answer.
- Marking: `src/lib/scoring.ts` owns BPSC's 1/3 penalty. Keep integer counts
  and fractional rates on separate clamps — a shared `Math.trunc` clamp once
  silently turned the 1/3 rate into 0.
- `profiles` has NO blanket update grant (that is the self-promotion guard).
  Every new learner-editable profile column needs its own
  `grant update (col) on public.profiles to authenticated`.
- PostgREST `upsert` writes a WHOLE row: a column left out of the payload is
  reset to its default. `question_notes` carries both a bookmark and a note,
  so both writers read the current row and merge (see `currentNote`).
- Groq retires models without notice — the Llama 3.x line vanished mid-project
  and every call 404'd. `GET https://api.groq.com/openai/v1/models` lists what
  a key can actually reach; override with `AI_MODEL`.
- `node scripts/tag-topics.mjs` tags questions with a closed BPSC syllabus
  taxonomy (free-form topics would fragment and make /progress useless).

## Non-negotiable working rules (from PRD.md §8)

1. No fabricated data — empty states over dummy data, real stats only.
2. Verify live with Playwright, zero console errors.
3. Gate before every commit (`npm run gate`).
4. Honest failures — nothing "succeeds" empty.
5. New tables need RLS policies AND explicit grants (tables are no longer
   auto-exposed to the Data API roles).
