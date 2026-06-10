-- Perf: wrap auth.uid() in a scalar subquery so Postgres evaluates it once
-- per query instead of once per row (auth_rls_initplan advisor 0003).
ALTER POLICY "creators read own app daily views"
  ON public.app_views_daily
  USING (
    EXISTS (
      SELECT 1 FROM public.apps a
      WHERE a.id = app_views_daily.app_id
        AND a.user_id = (SELECT auth.uid())
    )
  );
