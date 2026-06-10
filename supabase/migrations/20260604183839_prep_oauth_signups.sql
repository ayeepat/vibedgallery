-- Allow profiles.email to be null because GitHub OAuth users can sign in
-- without a public email (we keep auth.users.email as the source of truth).
alter table public.profiles alter column email drop not null;

-- Replace handle_new_user so OAuth signups also get a name + avatar from
-- whatever the provider returned. Falls back to the local part of the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
  resolved_avatar text;
begin
  resolved_name := nullif(trim(coalesce(
    meta->>'name',
    meta->>'full_name',
    meta->>'user_name',
    meta->>'preferred_username',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');

  resolved_avatar := nullif(trim(coalesce(
    meta->>'avatar_url',
    meta->>'picture'
  )), '');

  insert into public.profiles (id, email, name, avatar_url, role)
  values (new.id, new.email, resolved_name, resolved_avatar, 'user')
  on conflict (id) do update
    set email      = coalesce(excluded.email,      public.profiles.email),
        name       = coalesce(public.profiles.name,       excluded.name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$function$;
