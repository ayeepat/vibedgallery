-- Resubmit fix: the old full-row unique index on (user_id, lower(slug)) let a
-- REJECTED app hold its slug forever, so the maker could never resubmit the
-- same app at the same link (Profile → Resubmit inserts a NEW row; owners
-- cannot UPDATE rejected rows under RLS). Rejected rows never serve a public
-- URL, so exclude them from the uniqueness rule.
--
-- Create the replacement first, then drop the old index, so there is no
-- window without slug uniqueness on live rows.

CREATE UNIQUE INDEX IF NOT EXISTS apps_user_slug_lower_live_key
  ON public.apps (user_id, lower(slug))
  WHERE status::text <> 'rejected';

DROP INDEX IF EXISTS public.apps_user_slug_lower_key;
