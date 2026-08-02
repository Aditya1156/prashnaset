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

## Non-negotiable working rules (from PRD.md §8)

1. No fabricated data — empty states over dummy data, real stats only.
2. Verify live with Playwright, zero console errors.
3. Gate before every commit (`npm run gate`).
4. Honest failures — nothing "succeeds" empty.
5. New tables need RLS policies AND explicit grants (tables are no longer
   auto-exposed to the Data API roles).
