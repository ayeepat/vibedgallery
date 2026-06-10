-- Reports: user-submitted abuse / flag reports for an app. Admin-reviewed.
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  app_id       uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  reporter_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  category     varchar(40) NOT NULL DEFAULT 'other'
               CHECK (category IN ('spam','malicious','inappropriate','impersonation','copyright','other')),
  resolved     boolean NOT NULL DEFAULT false,
  resolved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS reports_app_id_idx       ON public.reports (app_id);
CREATE INDEX IF NOT EXISTS reports_unresolved_idx   ON public.reports (created_at DESC) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx  ON public.reports (reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users may file a report on any approved app. We pin reporter_id
-- to auth.uid() to prevent forgery; reason/category are length+enum-bounded by
-- the CHECK constraints above so a malicious client can't inject arbitrary
-- content beyond those limits. Anonymous reports are NOT allowed at the RLS
-- layer; the app exposes the report dialog only to signed-in users.
DROP POLICY IF EXISTS reports_insert_self ON public.reports;
CREATE POLICY reports_insert_self
  ON public.reports FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = reporter_id
    AND resolved = false
    AND resolved_by IS NULL
    AND resolved_at IS NULL
    -- Can only report an app that exists and is approved (no flagging
    -- pending/rejected rows that wouldn't be visible to the reporter anyway).
    AND EXISTS (
      SELECT 1 FROM public.apps a
      WHERE a.id = app_id AND a.status = 'approved'
    )
  );

-- Reporters can see their OWN reports (so the UI can show a "you reported
-- this" state); admins see everything.
DROP POLICY IF EXISTS reports_select_self_or_admin ON public.reports;
CREATE POLICY reports_select_self_or_admin
  ON public.reports FOR SELECT
  USING (
    (SELECT auth.uid()) = reporter_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  );

-- Only admins may update / resolve reports.
DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin
  ON public.reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT UPDATE         ON public.reports TO authenticated;
