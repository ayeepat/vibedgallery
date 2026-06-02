-- Row Level Security for profiles and apps.
--
-- The client uses the public anon key, so all authorization MUST be
-- enforced here. Policies follow least-privilege.

-- ---------------------------------------------------------------------------
-- Helper: is_admin()
--
-- SECURITY DEFINER so it can read profiles.role without being subject to the
-- profiles RLS policies (which would otherwise recurse).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ===========================================================================
-- profiles
-- ===========================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

-- A user can read their own profile; admins can read all.
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  using ( id = auth.uid() or public.is_admin() );

-- A user can create only their own profile row.
create policy "profiles_insert_self"
  on public.profiles
  for insert
  with check ( id = auth.uid() );

-- A user can update only their own profile row.
create policy "profiles_update_own"
  on public.profiles
  for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- Admins can do anything to any profile.
create policy "profiles_admin_all"
  on public.profiles
  for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ---------------------------------------------------------------------------
-- Prevent privilege escalation: a non-admin cannot change their own role.
-- (The update policy above otherwise allows users to edit their own row,
--  including the role column.)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change the role column';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_self_escalation();

-- ===========================================================================
-- apps
-- ===========================================================================
alter table public.apps enable row level security;

drop policy if exists "apps_select_approved_public" on public.apps;
drop policy if exists "apps_select_own" on public.apps;
drop policy if exists "apps_select_admin" on public.apps;
drop policy if exists "apps_insert_own" on public.apps;
drop policy if exists "apps_update_own" on public.apps;
drop policy if exists "apps_admin_all" on public.apps;

-- Anyone (including anonymous visitors) can read approved apps.
create policy "apps_select_approved_public"
  on public.apps
  for select
  using ( status = 'approved' );

-- Owners can read their own apps in any status.
create policy "apps_select_own"
  on public.apps
  for select
  using ( user_id = auth.uid() );

-- Admins can read all apps (e.g. the review queue).
create policy "apps_select_admin"
  on public.apps
  for select
  using ( public.is_admin() );

-- Authenticated users can insert only their own submissions.
create policy "apps_insert_own"
  on public.apps
  for insert
  with check ( user_id = auth.uid() );

-- Owners can update their own apps (e.g. completing ownership verification).
-- The review-workflow columns are guarded by a trigger below so owners
-- cannot self-approve.
create policy "apps_update_own"
  on public.apps
  for update
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- Admins can do anything to any app (the approve/reject workflow).
create policy "apps_admin_all"
  on public.apps
  for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ---------------------------------------------------------------------------
-- Only admins may change the review-workflow columns. This prevents an owner
-- from setting their own app to 'approved' via the apps_update_own policy.
-- ---------------------------------------------------------------------------
create or replace function public.guard_apps_review_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Only admins can modify review columns';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_apps_review_columns on public.apps;
create trigger trg_guard_apps_review_columns
  before update on public.apps
  for each row
  execute function public.guard_apps_review_columns();
