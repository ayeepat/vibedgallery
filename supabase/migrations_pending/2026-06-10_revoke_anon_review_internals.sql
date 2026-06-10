-- HARDENING: anon currently holds column-level SELECT on review-pipeline
-- internals of public.apps (verification_token, rejection_reason, reviewed_by,
-- reviewed_at, safe_browsing_passed, safe_browsing_threats). The client only
-- queries APP_PUBLIC_COLUMNS for anonymous reads, but nothing stops a raw
-- PostgREST request with the anon key from selecting these columns on any
-- approved row. None of the anon surfaces (gallery, app detail, search,
-- og-app, sitemap) read them.
--
-- `status` and all APP_PUBLIC_COLUMNS stay SELECT-able by anon — the gallery
-- filters .eq("status", "approved") and AppDetail's noindex check reads it.
-- authenticated keeps these columns: owners read their own verification_token
-- (Profile download) and admins read everything in the review queue.

REVOKE SELECT (verification_token)    ON public.apps FROM anon;
REVOKE SELECT (rejection_reason)      ON public.apps FROM anon;
REVOKE SELECT (reviewed_by)           ON public.apps FROM anon;
REVOKE SELECT (reviewed_at)           ON public.apps FROM anon;
REVOKE SELECT (safe_browsing_passed)  ON public.apps FROM anon;
REVOKE SELECT (safe_browsing_threats) ON public.apps FROM anon;
