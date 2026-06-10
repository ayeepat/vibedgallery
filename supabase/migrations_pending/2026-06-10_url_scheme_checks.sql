-- HARDENING: no CHECK constraint enforces a scheme on the URL columns of
-- apps / app_edits. The client normalizes everything to https://, but a direct
-- PostgREST insert (any authenticated user can insert their own rows) could
-- store javascript:/data: URLs that get rendered as hrefs in the admin panel
-- and, post-approval, on the public app page. The client now scheme-gates
-- every stored URL before rendering (safeHttpUrl), and CSP blocks javascript:
-- navigation — this constraint closes the hole at the source.
--
-- Verified 2026-06-10: zero existing rows violate these patterns, so the
-- VALIDATE steps will succeed. NOT VALID + VALIDATE keeps the lock window
-- minimal anyway.

ALTER TABLE public.apps
  ADD CONSTRAINT apps_url_scheme CHECK (url IS NULL OR url ~* '^https?://') NOT VALID,
  ADD CONSTRAINT apps_demo_video_url_scheme CHECK (demo_video_url IS NULL OR demo_video_url ~* '^https?://') NOT VALID,
  ADD CONSTRAINT apps_submitter_github_scheme CHECK (submitter_github IS NULL OR submitter_github ~* '^https?://') NOT VALID;

ALTER TABLE public.apps VALIDATE CONSTRAINT apps_url_scheme;
ALTER TABLE public.apps VALIDATE CONSTRAINT apps_demo_video_url_scheme;
ALTER TABLE public.apps VALIDATE CONSTRAINT apps_submitter_github_scheme;

ALTER TABLE public.app_edits
  ADD CONSTRAINT app_edits_url_scheme CHECK (url IS NULL OR url ~* '^https?://') NOT VALID,
  ADD CONSTRAINT app_edits_demo_video_url_scheme CHECK (demo_video_url IS NULL OR demo_video_url ~* '^https?://') NOT VALID,
  ADD CONSTRAINT app_edits_submitter_github_scheme CHECK (submitter_github IS NULL OR submitter_github ~* '^https?://') NOT VALID;

ALTER TABLE public.app_edits VALIDATE CONSTRAINT app_edits_url_scheme;
ALTER TABLE public.app_edits VALIDATE CONSTRAINT app_edits_demo_video_url_scheme;
ALTER TABLE public.app_edits VALIDATE CONSTRAINT app_edits_submitter_github_scheme;
