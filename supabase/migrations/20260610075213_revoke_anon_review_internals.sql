-- anon held column-level SELECT on review-pipeline internals of public.apps.
-- No anonymous surface (gallery, app detail, search, og-app, sitemap) reads
-- them; a raw PostgREST request with the anon key could. status and all
-- APP_PUBLIC_COLUMNS stay SELECT-able by anon; authenticated is untouched
-- (owners read their own verification_token, admins read everything).

REVOKE SELECT (verification_token)    ON public.apps FROM anon;
REVOKE SELECT (rejection_reason)      ON public.apps FROM anon;
REVOKE SELECT (reviewed_by)           ON public.apps FROM anon;
REVOKE SELECT (reviewed_at)           ON public.apps FROM anon;
REVOKE SELECT (safe_browsing_passed)  ON public.apps FROM anon;
REVOKE SELECT (safe_browsing_threats) ON public.apps FROM anon;
