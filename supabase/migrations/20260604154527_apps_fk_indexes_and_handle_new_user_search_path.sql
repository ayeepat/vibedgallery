-- Cover the FKs that the planner currently has to seq-scan.
CREATE INDEX IF NOT EXISTS apps_user_id_idx     ON public.apps (user_id);
CREATE INDEX IF NOT EXISTS apps_reviewed_by_idx ON public.apps (reviewed_by);

-- Pin search_path so a hijacked schema can't shadow public.profiles.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;
