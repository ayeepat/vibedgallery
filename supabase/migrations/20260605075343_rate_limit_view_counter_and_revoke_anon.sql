-- ─────────────────────────────────────────────────────────────────────
-- 1. Per-IP throttle for increment_app_views
-- ─────────────────────────────────────────────────────────────────────
-- A single (ip, app_id) pair can only trigger one view bump per
-- THROTTLE_WINDOW (30 min). Without this, anon callers can blow the
-- counter to infinity with a one-liner, because the sessionStorage
-- check on the client is the only existing defence.

CREATE TABLE IF NOT EXISTS public.view_throttle (
  ip               text        NOT NULL,
  app_id           uuid        NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  last_viewed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, app_id)
);

CREATE INDEX IF NOT EXISTS view_throttle_last_viewed_at_idx
  ON public.view_throttle (last_viewed_at);

ALTER TABLE public.view_throttle ENABLE ROW LEVEL SECURITY;
-- No policies — only the SECURITY DEFINER functions below touch this table.
REVOKE ALL ON public.view_throttle FROM anon, authenticated;

-- Cleanup: drop rows older than 1 day. Call periodically (pg_cron, or just
-- manually for now — the throttle table is self-bounded by unique IPs and
-- staleness only wastes a tiny amount of disk).
CREATE OR REPLACE FUNCTION public.cleanup_view_throttle()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  DELETE FROM public.view_throttle
   WHERE last_viewed_at < now() - interval '1 day';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_view_throttle() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Rate-limited increment_app_views
-- ─────────────────────────────────────────────────────────────────────
-- Replaces the previous unthrottled version. Behaviour:
--   - Looks up the caller's IP from PostgREST's request.headers GUC,
--     preferring cf-connecting-ip and falling back to the first
--     x-forwarded-for hop.
--   - Atomically claims a (ip, app) bucket via INSERT ... ON CONFLICT
--     DO UPDATE WHERE last_viewed_at < now() - 30 min. RETURNING is NULL
--     when the conflict is suppressed by the WHERE (i.e. still inside
--     the window), so we no-op.
--   - Only bumps approved rows.

CREATE OR REPLACE FUNCTION public.increment_app_views(target_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  throttle_window constant interval := interval '30 minutes';
  ip_text         text;
  claimed         boolean;
BEGIN
  -- Best-effort IP extraction. If the GUC isn't set (running outside a
  -- PostgREST request), fall back to a single 'unknown' bucket so that
  -- environments without a real IP can still increment, but collectively
  -- — they can't bypass the throttle.
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
    -- Same (ip, app) inside the throttle window. Silently no-op.
    RETURN;
  END IF;

  UPDATE public.apps
     SET views = coalesce(views, 0) + 1
   WHERE id = target_app_id
     AND status = 'approved';
END;
$$;

-- Anon still needs EXECUTE — that's the whole point (anon visitors are
-- who we're counting). The throttle table makes the previous
-- "anon-callable, unlimited" advisor warning defensible.
GRANT EXECUTE ON FUNCTION public.increment_app_views(uuid) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Revoke anon EXECUTE on get_app_submitter_email
-- ─────────────────────────────────────────────────────────────────────
-- The function already short-circuits to NULL when auth.uid() IS NULL,
-- so anon could call it harmlessly. But the cleaner posture is to
-- block the call at the GRANT layer so the Supabase advisor stops
-- flagging it, and to make intent explicit.

REVOKE EXECUTE ON FUNCTION public.get_app_submitter_email(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_app_submitter_email(uuid) TO authenticated;
