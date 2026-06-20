-- Beta "Idea Requests" feed: users post "I wish this existed", anyone signed in
-- (founders/makers) can reply, Threads-style. No moderation queue — posts and
-- replies go live immediately. Reads are public; writes require auth and are
-- pinned to auth.uid() so authorship can't be forged. Rate-limit triggers and
-- length CHECKs guard against spam/abuse.

-- ── Requests ──────────────────────────────────────────────────────────────
create table if not exists public.idea_requests (
  id         uuid primary key default extensions.uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 3 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idea_requests_created_at_idx on public.idea_requests (created_at desc);
create index if not exists idea_requests_user_id_idx    on public.idea_requests (user_id);

-- ── Replies ───────────────────────────────────────────────────────────────
create table if not exists public.idea_replies (
  id         uuid primary key default extensions.uuid_generate_v4(),
  request_id uuid not null references public.idea_requests(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idea_replies_request_id_idx on public.idea_replies (request_id, created_at);
create index if not exists idea_replies_user_id_idx    on public.idea_replies (user_id);

-- ── "Me too" votes ────────────────────────────────────────────────────────
create table if not exists public.idea_request_votes (
  id         uuid primary key default extensions.uuid_generate_v4(),
  request_id uuid not null references public.idea_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (request_id, user_id)
);

create index if not exists idea_request_votes_request_id_idx on public.idea_request_votes (request_id);
create index if not exists idea_request_votes_user_id_idx    on public.idea_request_votes (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.idea_requests      enable row level security;
alter table public.idea_replies       enable row level security;
alter table public.idea_request_votes enable row level security;

-- Requests: world-readable; author-pinned insert; author or admin delete.
drop policy if exists idea_requests_select_all   on public.idea_requests;
create policy idea_requests_select_all  on public.idea_requests for select using (true);

drop policy if exists idea_requests_insert_self  on public.idea_requests;
create policy idea_requests_insert_self on public.idea_requests for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists idea_requests_delete_owner_or_admin on public.idea_requests;
create policy idea_requests_delete_owner_or_admin on public.idea_requests for delete
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

-- Replies: same shape.
drop policy if exists idea_replies_select_all  on public.idea_replies;
create policy idea_replies_select_all  on public.idea_replies for select using (true);

drop policy if exists idea_replies_insert_self on public.idea_replies;
create policy idea_replies_insert_self on public.idea_replies for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.idea_requests r where r.id = request_id)
  );

drop policy if exists idea_replies_delete_owner_or_admin on public.idea_replies;
create policy idea_replies_delete_owner_or_admin on public.idea_replies for delete
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

-- Votes: world-readable counts; author-pinned insert; own delete (toggle off).
drop policy if exists idea_request_votes_select_all  on public.idea_request_votes;
create policy idea_request_votes_select_all  on public.idea_request_votes for select using (true);

drop policy if exists idea_request_votes_insert_self on public.idea_request_votes;
create policy idea_request_votes_insert_self on public.idea_request_votes for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists idea_request_votes_delete_self on public.idea_request_votes;
create policy idea_request_votes_delete_self on public.idea_request_votes for delete
  using ((select auth.uid()) = user_id);

-- ── Base GRANTs ───────────────────────────────────────────────────────────
-- RLS policies are necessary but NOT sufficient — without these table GRANTs
-- every write fails with "permission denied" (the bug that previously zeroed
-- the upvote button). Grant exactly what the policies above assume.
grant select                 on public.idea_requests      to anon, authenticated;
grant insert, delete         on public.idea_requests      to authenticated;
grant select                 on public.idea_replies       to anon, authenticated;
grant insert, delete         on public.idea_replies       to authenticated;
grant select                 on public.idea_request_votes to anon, authenticated;
grant insert, delete         on public.idea_request_votes to authenticated;

-- ── Spam / abuse rate limits (admins exempt) ──────────────────────────────
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

  if recent >= 15 then
    raise exception 'Rate limit: too many idea posts in the last hour. Try again later.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists idea_requests_rate_limit on public.idea_requests;
create trigger idea_requests_rate_limit
  before insert on public.idea_requests
  for each row execute function public.enforce_idea_requests_rate_limit();

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

  if recent >= 40 then
    raise exception 'Rate limit: too many replies in the last hour. Try again later.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists idea_replies_rate_limit on public.idea_replies;
create trigger idea_replies_rate_limit
  before insert on public.idea_replies
  for each row execute function public.enforce_idea_replies_rate_limit();
