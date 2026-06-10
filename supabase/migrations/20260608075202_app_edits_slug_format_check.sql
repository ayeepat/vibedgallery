-- Mirror the apps_slug_format CHECK so a malformed slug can't sit in the edit
-- queue waiting to break the apps UPDATE at approval time. Client-side already
-- validates via isValidSlug(); this is the trusted backstop.
ALTER TABLE public.app_edits
  ADD CONSTRAINT app_edits_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9](?:[a-z0-9_-]{0,58}[a-z0-9])?$');
