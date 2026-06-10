-- Enforce http(s) scheme on URL columns of apps / app_edits so a direct
-- PostgREST insert can't store javascript:/data: URLs that render as hrefs.
-- Verified zero existing rows violate these patterns.

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
