-- View counter: anon/authenticated have no UPDATE on apps. Use a security
-- definer RPC that only bumps views on approved rows.
create or replace function public.increment_app_views(target_app_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.apps
     set views = coalesce(views, 0) + 1
   where id = target_app_id
     and status = 'approved'
$$;

revoke all on function public.increment_app_views(uuid) from public;
grant execute on function public.increment_app_views(uuid) to anon, authenticated;

-- Partial indexes for the gallery's two sort orders on approved rows.
create index if not exists apps_approved_created_at_idx
  on public.apps (created_at desc)
  where status = 'approved';

create index if not exists apps_approved_upvotes_idx
  on public.apps (upvotes desc, created_at desc)
  where status = 'approved';
