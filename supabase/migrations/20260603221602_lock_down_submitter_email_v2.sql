-- Table-level GRANTs implicitly cover every column; column-level REVOKE
-- alone has no effect. The correct sequence is: revoke table-level
-- SELECT/INSERT/UPDATE, then re-grant per-column, excluding submitter_email.

REVOKE SELECT ON public.apps FROM anon, authenticated;
REVOKE INSERT ON public.apps FROM anon, authenticated;
REVOKE UPDATE ON public.apps FROM anon, authenticated;

-- Re-grant SELECT on everything except submitter_email.
GRANT SELECT (
  id, user_id, submitter_twitter, submitter_github,
  title, tagline, description, url, category, tags,
  primary_tool, other_tools, demo_video_url,
  thumbnail_url, screenshot_urls,
  verification_token, ownership_verified,
  safe_browsing_passed, safe_browsing_threats, thumbnail_flagged,
  status, rejection_reason,
  reviewed_by, reviewed_at,
  upvotes, views,
  created_at, updated_at
) ON public.apps TO anon, authenticated;

-- Authenticated can INSERT every non-server-managed column EXCEPT submitter_email.
GRANT INSERT (
  user_id, submitter_twitter, submitter_github,
  title, tagline, description, url, category, tags,
  primary_tool, other_tools, demo_video_url,
  thumbnail_url, screenshot_urls,
  verification_token, ownership_verified,
  safe_browsing_passed, safe_browsing_threats, thumbnail_flagged,
  status, rejection_reason
) ON public.apps TO authenticated;

-- Authenticated can UPDATE the mutable fields (RLS still gates which rows).
GRANT UPDATE (
  submitter_twitter, submitter_github,
  title, tagline, description, url, category, tags,
  primary_tool, other_tools, demo_video_url,
  thumbnail_url, screenshot_urls,
  ownership_verified, status, rejection_reason,
  reviewed_by, reviewed_at,
  upvotes, views,
  updated_at
) ON public.apps TO authenticated;
