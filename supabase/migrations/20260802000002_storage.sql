-- Private bucket for the original import files, one folder per user.
-- Kept in its own migration: storage privileges differ between local and
-- hosted projects, and the app treats the upload as best-effort.

insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "imports_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
