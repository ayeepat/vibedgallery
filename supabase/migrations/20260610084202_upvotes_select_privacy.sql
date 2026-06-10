-- The public SELECT policy on upvotes exposed (user_id, app_id, created_at)
-- to anyone — i.e. who upvoted what. Nothing public needs the raw rows:
-- gallery counts come from the trigger-maintained apps.upvotes counter.
-- Readers that DO need rows: a signed-in user checking their own upvote
-- (UpvoteButton) and a maker reading upvote events on their own apps
-- (AnalyticsPanel). Scope SELECT to exactly those.

DROP POLICY "Anyone can read upvotes" ON public.upvotes;

CREATE POLICY upvotes_select_own_or_app_owner ON public.upvotes
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.apps a
      WHERE a.id = upvotes.app_id AND a.user_id = (SELECT auth.uid())
    )
  );

-- anon had a table-level SELECT grant; no anon code path reads upvotes.
REVOKE SELECT ON public.upvotes FROM anon;
