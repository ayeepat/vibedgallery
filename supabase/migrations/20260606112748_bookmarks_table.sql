-- Bookmarks: per-user saved apps. Composite PK ensures one bookmark per
-- (user, app) pair without an extra unique index.
CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id     uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, app_id)
);

-- Reverse lookup index for "all bookmarks of an app" queries (cheap if we ever
-- need a count badge; otherwise no-op). The primary key already covers
-- "all bookmarks of a user, joined to apps".
CREATE INDEX IF NOT EXISTS bookmarks_app_id_idx ON public.bookmarks (app_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- A user can only see / mutate their OWN bookmarks. No cross-user reads —
-- otherwise the bookmark list becomes a social leak.
DROP POLICY IF EXISTS bookmarks_select_own ON public.bookmarks;
CREATE POLICY bookmarks_select_own
  ON public.bookmarks FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS bookmarks_insert_own ON public.bookmarks;
CREATE POLICY bookmarks_insert_own
  ON public.bookmarks FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS bookmarks_delete_own ON public.bookmarks;
CREATE POLICY bookmarks_delete_own
  ON public.bookmarks FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
