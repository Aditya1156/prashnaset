-- Admin-controlled batch membership.
--
-- profiles_update_own only ever covered a learner's own row, so an admin had
-- no way to move somebody between batches — a wrong pick at signup was
-- permanent. This adds the same admin-guarded definer function already used
-- for roles (admin_set_role) and subscriptions (admin_set_subscription).
--
-- The learner-facing column grant is withdrawn at the same time: assignments
-- target batches, so self-service switching let a learner leave a batch to
-- shed an assignment. Signup still sets batch_id through handle_new_user(),
-- which is security definer and unaffected by the grant.

create function public.admin_set_batch(target_id uuid, new_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can move learners between batches';
  end if;
  if new_batch_id is not null
     and not exists (select 1 from public.batches where id = new_batch_id) then
    raise exception 'batch not found';
  end if;
  update public.profiles set batch_id = new_batch_id where id = target_id;
end;
$$;

grant execute on function public.admin_set_batch(uuid, uuid) to authenticated;

revoke update (batch_id) on table public.profiles from authenticated;
