-- Admin-only per-app maker handle override. Lets an admin publish an app under
-- a fictitious handle without renaming their own profile or breaking the URLs
-- of any of their previously submitted apps.

alter table public.apps
  add column if not exists display_username text,
  add column if not exists display_name text;

alter table public.apps
  drop constraint if exists apps_display_username_format;
alter table public.apps
  add constraint apps_display_username_format check (
    display_username is null or (
      display_username ~ '^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$'
      and display_username not in (
        'app','apps','maker','makers','tag','tags','auth','gallery','submit',
        'admin','profile','login','register','about','how-it-works',
        'forgot-password','reset-password','privacy','terms','api','www',
        'sitemap','assets','static','public','og-app'
      )
    )
  );

alter table public.apps
  drop constraint if exists apps_display_name_length;
alter table public.apps
  add constraint apps_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  );

create unique index if not exists apps_public_handle_slug_lower_live_key
  on public.apps (
    coalesce(lower(display_username), 'u:' || user_id::text),
    lower(slug)
  )
  where status::text <> 'rejected';

drop index if exists public.apps_user_slug_lower_live_key;

create or replace function public.apps_validate_display_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if new.display_username is null and new.display_name is null then
    return new;
  end if;

  if auth.uid() is not null then
    select (role = 'admin') into is_admin
    from public.profiles
    where id = auth.uid();
    if not coalesce(is_admin, false) then
      raise exception 'display_username/display_name are admin-only'
        using errcode = '42501';
    end if;
  end if;

  if new.display_username is not null then
    if exists (
      select 1 from public.profiles
      where lower(username) = lower(new.display_username)
    ) then
      raise exception 'display_username % collides with a real maker handle', new.display_username
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists apps_validate_display_username on public.apps;
create trigger apps_validate_display_username
  before insert or update of display_username, display_name on public.apps
  for each row execute function public.apps_validate_display_username();

create or replace function public.profiles_block_display_username_collision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is null then
    return new;
  end if;
  if exists (
    select 1 from public.apps
    where lower(display_username) = lower(new.username)
  ) then
    raise exception 'username % is already in use as a display handle', new.username
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_display_username_collision on public.profiles;
create trigger profiles_block_display_username_collision
  before insert or update of username on public.profiles
  for each row execute function public.profiles_block_display_username_collision();

grant select(display_username, display_name) on public.apps to anon, authenticated;
grant insert(display_username, display_name), update(display_username, display_name)
  on public.apps to authenticated;
