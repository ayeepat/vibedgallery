-- Daily aggregated view counts per app — feeds creator analytics charts.
-- Only owners can read their own apps' daily rows via RLS.
CREATE TABLE IF NOT EXISTS public.app_views_daily (
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, day)
);

CREATE INDEX IF NOT EXISTS app_views_daily_app_day_idx
  ON public.app_views_daily (app_id, day DESC);

ALTER TABLE public.app_views_daily ENABLE ROW LEVEL SECURITY;

-- Creators can read daily stats only for apps they own.
DROP POLICY IF EXISTS "creators read own app daily views" ON public.app_views_daily;
CREATE POLICY "creators read own app daily views"
  ON public.app_views_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apps a
      WHERE a.id = app_views_daily.app_id
        AND a.user_id = auth.uid()
    )
  );

-- Extend increment_app_views: keep all existing throttling/IP logic, then
-- additionally upsert the day bucket so we have a 30-day timeseries to chart.
CREATE OR REPLACE FUNCTION public.increment_app_views(target_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  throttle_window constant interval := interval '30 minutes';
  ip_text         text;
  claimed         boolean;
  is_approved     boolean;
BEGIN
  BEGIN
    ip_text := coalesce(
      current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
      split_part(
        current_setting('request.headers', true)::json ->> 'x-forwarded-for',
        ',', 1
      )
    );
  EXCEPTION WHEN others THEN
    ip_text := NULL;
  END;

  ip_text := nullif(btrim(ip_text), '');
  IF ip_text IS NULL THEN
    ip_text := 'unknown';
  END IF;

  INSERT INTO public.view_throttle (ip, app_id, last_viewed_at)
  VALUES (ip_text, target_app_id, now())
  ON CONFLICT (ip, app_id) DO UPDATE
    SET last_viewed_at = excluded.last_viewed_at
   WHERE public.view_throttle.last_viewed_at < now() - throttle_window
  RETURNING true INTO claimed;

  IF claimed IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.apps
     SET views = coalesce(views, 0) + 1
   WHERE id = target_app_id
     AND status = 'approved'
  RETURNING true INTO is_approved;

  -- Only record daily analytics for approved apps (mirrors the totals counter).
  IF is_approved IS TRUE THEN
    INSERT INTO public.app_views_daily (app_id, day, views)
    VALUES (target_app_id, (now() AT TIME ZONE 'utc')::date, 1)
    ON CONFLICT (app_id, day) DO UPDATE
      SET views = public.app_views_daily.views + 1;
  END IF;
END;
$function$;
