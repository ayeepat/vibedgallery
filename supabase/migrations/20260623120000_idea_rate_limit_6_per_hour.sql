-- Tighten idea/reply posting rate limits to 6 per hour per user (was 15/40).
-- Admins remain exempt. Trigger wiring is unchanged — only the thresholds and
-- messages move. See 20260620120000_idea_requests_feature.sql for the triggers.
create or replace function public.enforce_idea_requests_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare recent int; is_admin boolean;
begin
  select exists (
    select 1 from public.profiles where id = new.user_id and role::text = 'admin'
  ) into is_admin;
  if is_admin then return new; end if;

  select count(*) into recent
  from public.idea_requests
  where user_id = new.user_id
    and created_at > (timezone('utc', now()) - interval '1 hour');

  if recent >= 6 then
    raise exception 'Rate limit: you can post at most 6 ideas per hour. Try again later.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_idea_replies_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare recent int; is_admin boolean;
begin
  select exists (
    select 1 from public.profiles where id = new.user_id and role::text = 'admin'
  ) into is_admin;
  if is_admin then return new; end if;

  select count(*) into recent
  from public.idea_replies
  where user_id = new.user_id
    and created_at > (timezone('utc', now()) - interval '1 hour');

  if recent >= 6 then
    raise exception 'Rate limit: you can post at most 6 replies per hour. Try again later.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
