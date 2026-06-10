-- Rate limit submissions:
--   * Max 3 in-flight submissions per user (pending_verification or pending_review)
--   * Max 5 new submissions per user per 24h
-- Admins bypass both limits.

CREATE OR REPLACE FUNCTION public.enforce_apps_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pending_count int;
  recent_count int;
  is_admin boolean;
BEGIN
  -- Admins are exempt.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND role::text = 'admin'
  ) INTO is_admin;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- In-flight cap.
  SELECT COUNT(*) INTO pending_count
  FROM public.apps
  WHERE user_id = NEW.user_id
    AND status::text IN ('pending_verification', 'pending_review');

  IF pending_count >= 3 THEN
    RAISE EXCEPTION
      'Rate limit: you already have % submissions pending review. Wait for them to be processed before submitting again.',
      pending_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- 24h rolling cap (all statuses).
  SELECT COUNT(*) INTO recent_count
  FROM public.apps
  WHERE user_id = NEW.user_id
    AND created_at > (timezone('utc', now()) - INTERVAL '24 hours');

  IF recent_count >= 5 THEN
    RAISE EXCEPTION
      'Rate limit: you can submit at most 5 apps per 24 hours. Try again tomorrow.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apps_rate_limit ON public.apps;

CREATE TRIGGER apps_rate_limit
BEFORE INSERT ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_apps_rate_limit();
