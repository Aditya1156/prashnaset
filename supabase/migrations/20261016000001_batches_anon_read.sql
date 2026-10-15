-- Let the signup page list batches.
--
-- The batch picker on /signup has never rendered. The page server-renders for
-- a visitor who is, by definition, not yet authenticated, but the only select
-- policy on batches is scoped `to authenticated` — so the query came back
-- empty, the form's `batches.length > 0` guard hid the field, and every
-- signup silently fell through to the name-matched default inside
-- handle_new_user(). Verified against the live project: an anonymous
-- GET /rest/v1/batches returns 200 with an empty array.
--
-- Only active batches are exposed, and only the columns the picker renders.
-- These names are already public by design — they are the options in a
-- dropdown on a logged-out page.

create policy "batches_select_anon" on public.batches
  for select to anon using (is_active);

grant select (id, name, is_active) on public.batches to anon;
