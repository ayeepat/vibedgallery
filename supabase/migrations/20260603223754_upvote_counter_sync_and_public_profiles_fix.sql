-- 1) Keep apps.upvotes in sync with the upvotes table. This way "Trending"
--    on the gallery (which sorts by apps.upvotes) is always correct, and
--    card thumbnails can show the count without an extra round-trip.

CREATE OR REPLACE FUNCTION public.sync_app_upvote_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.apps
    SET upvotes = COALESCE(upvotes, 0) + 1
    WHERE id = NEW.app_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.apps
    SET upvotes = GREATEST(COALESCE(upvotes, 0) - 1, 0)
    WHERE id = OLD.app_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS upvotes_sync_counter ON public.upvotes;

CREATE TRIGGER upvotes_sync_counter
AFTER INSERT OR DELETE ON public.upvotes
FOR EACH ROW EXECUTE FUNCTION public.sync_app_upvote_counter();

-- One-time backfill in case anything was inserted before the trigger existed.
UPDATE public.apps a
SET upvotes = COALESCE(sub.cnt, 0)
FROM (
  SELECT app_id, COUNT(*) AS cnt
  FROM public.upvotes
  GROUP BY app_id
) sub
WHERE a.id = sub.app_id;

-- 2) Rebuild public_profiles without security_invoker so anon visitors
--    (unauthenticated users) can read public maker info. The view only
--    exposes safe columns (no email). RLS on the underlying profiles table
--    still blocks anyone trying to query it directly.

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT id, name, role, avatar_url, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
