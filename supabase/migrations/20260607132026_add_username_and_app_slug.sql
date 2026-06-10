-- Pretty app URLs: vibedgallery.com/<username>/<appslug>
-- 1) profiles.username — global, case-insensitive unique maker handle
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles
  add constraint profiles_username_format check (
    username is null or (
      username ~ '^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$'
      and username not in (
        'app','apps','maker','makers','tag','tags','auth','gallery','submit',
        'admin','profile','login','register','about','how-it-works',
        'forgot-password','reset-password','privacy','terms','api','www',
        'sitemap','assets','static','public','og-app'
      )
    )
  );

-- authenticated users set their own handle via updateProfile() (UPDATE);
-- INSERT grant keeps self-insert paths consistent. SELECT is table-level already.
grant update(username), insert(username) on public.profiles to authenticated;

-- 2) apps.slug — unique within a maker (case-insensitive)
alter table public.apps add column if not exists slug text;

create unique index if not exists apps_user_slug_lower_key
  on public.apps (user_id, lower(slug));

alter table public.apps
  add constraint apps_slug_format check (
    slug is null or slug ~ '^[a-z0-9](?:[a-z0-9_-]{0,58}[a-z0-9])?$'
  );

grant select(slug) on public.apps to anon, authenticated;
grant insert(slug), update(slug) on public.apps to authenticated;

-- 3) FK apps.user_id -> profiles.id so PostgREST can embed the maker handle
--    in a single round-trip. Matches the existing auth.users FK (ON DELETE CASCADE).
alter table public.apps
  add constraint apps_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 4) Surface username on the public maker view (column appended at the end so
--    CREATE OR REPLACE keeps existing positions).
create or replace view public.public_profiles as
  select id, name, role, avatar_url, created_at, username from public.profiles;
