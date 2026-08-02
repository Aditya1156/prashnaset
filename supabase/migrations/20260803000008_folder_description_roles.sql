-- Folder descriptions (shown on library cards) and an admin-guarded role
-- switch so admins can promote/demote from the Users page.

alter table public.folders
  add column description text;

create function public.admin_set_role(target_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'only admins can manage roles';
  end if;

  select u.email into target_email from auth.users u where u.id = target_id;

  -- The designated admin can never be demoted, and admins cannot demote
  -- themselves (prevents locking the product out of administration).
  if not make_admin and lower(coalesce(target_email, '')) = 'adityaissc7@gmail.com' then
    raise exception 'the designated admin cannot be demoted';
  end if;
  if not make_admin and target_id = auth.uid() then
    raise exception 'you cannot demote yourself';
  end if;

  update public.profiles
  set role = case when make_admin then 'admin' else 'user' end
  where id = target_id;
end;
$$;

grant execute on function public.admin_set_role(uuid, boolean) to authenticated;
