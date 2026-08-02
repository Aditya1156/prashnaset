-- Subscriptions + hardened profiles.
--
-- 1. profiles carries email (for the admin Users page), subscription_status
--    and subscription_expires_at (reserved for future payment integration).
-- 2. SECURITY FIX: users could previously UPDATE their whole own profile row,
--    including role. Direct updates are now column-restricted to display_name;
--    role/subscription changes go through admin-guarded definer functions.
-- 3. adityaissc7@gmail.com is the designated admin: promoted if the account
--    exists, and auto-promoted on signup.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column email text,
  add column subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active')),
  add column subscription_expires_at timestamptz;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Designated admin.
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) = 'adityaissc7@gmail.com';

-- ---------------------------------------------------------------------------
-- Signup bootstrap: designated admin email, or the very first account.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case
      when lower(new.email) = 'adityaissc7@gmail.com' then 'admin'
      when exists (select 1 from public.profiles where role = 'admin') then 'user'
      else 'admin'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles access: admins can read every profile; direct updates are limited
-- to display_name at the column level.
-- ---------------------------------------------------------------------------
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-guarded subscription switch (definer function, not table access).
-- ---------------------------------------------------------------------------
create function public.admin_set_subscription(target_id uuid, make_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can manage subscriptions';
  end if;
  update public.profiles
  set
    subscription_status = case when make_active then 'active' else 'free' end,
    subscription_expires_at = null
  where id = target_id;
end;
$$;

grant execute on function public.admin_set_subscription(uuid, boolean) to authenticated;
