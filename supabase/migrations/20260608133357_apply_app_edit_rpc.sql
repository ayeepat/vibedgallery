-- apply_app_edit: SECURITY DEFINER RPC that copies an approved edit onto the
-- live apps row and marks the edit row approved, atomically.
--
-- Why a RPC and not two client UPDATEs?
--   1. Atomicity — apps and app_edits move together, or neither moves.
--   2. Column-level GRANTs on apps restrict authenticated from UPDATEing
--      certain columns (e.g. verification_token, safe_browsing_*). The two
--      client UPDATEs that used to do this failed with "permission denied
--      for table apps" the moment an edit touched a locked-down column.
--      Running as SECURITY DEFINER (owner: postgres) bypasses those grants
--      while still gating who can call this on caller's role.
--
-- The function does its own admin-role check so a non-admin can't invoke it
-- even though EXECUTE is granted to authenticated.
--
-- Safe Browsing override: pass p_safe_browsing_passed / p_safe_browsing_threats
-- when the caller has just done a fresh recheck on the new URL. If null, the
-- function falls back to whatever the creator submitted with.

CREATE OR REPLACE FUNCTION public.apply_app_edit(
  p_edit_id uuid,
  p_safe_browsing_passed boolean DEFAULT NULL,
  p_safe_browsing_threats text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_edit public.app_edits%ROWTYPE;
  v_url_changed boolean;
BEGIN
  -- Admin gate. Callable by any authenticated user, but only admins mutate.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller AND role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;

  -- Lock the edit so two admins can't race each other.
  SELECT * INTO v_edit FROM public.app_edits
    WHERE id = p_edit_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_edit.status NOT IN ('pending_verification','pending_review') THEN
    RAISE EXCEPTION 'Edit is not in a pending state (%)', v_edit.status USING ERRCODE = '22023';
  END IF;

  -- URL change detection drives token + ownership_verified handling.
  SELECT (apps.url IS DISTINCT FROM v_edit.url) INTO v_url_changed
    FROM public.apps WHERE id = v_edit.app_id;

  UPDATE public.apps AS apps SET
    title                = v_edit.title,
    tagline              = v_edit.tagline,
    description          = v_edit.description,
    url                  = v_edit.url,
    category             = v_edit.category,
    tags                 = COALESCE(v_edit.tags, ARRAY[]::text[]),
    primary_tool         = v_edit.primary_tool,
    other_tools          = v_edit.other_tools,
    demo_video_url       = v_edit.demo_video_url,
    thumbnail_url        = v_edit.thumbnail_url,
    screenshot_urls      = COALESCE(v_edit.screenshot_urls, ARRAY[]::text[]),
    slug                 = v_edit.slug,
    submitter_twitter    = v_edit.submitter_twitter,
    submitter_github     = v_edit.submitter_github,
    verification_token   = CASE WHEN v_url_changed AND v_edit.verification_token IS NOT NULL
                                THEN v_edit.verification_token
                                ELSE apps.verification_token END,
    ownership_verified   = CASE WHEN v_url_changed
                                THEN v_edit.ownership_verified
                                ELSE apps.ownership_verified END,
    safe_browsing_passed = COALESCE(p_safe_browsing_passed, v_edit.safe_browsing_passed, apps.safe_browsing_passed),
    safe_browsing_threats = COALESCE(p_safe_browsing_threats, v_edit.safe_browsing_threats, apps.safe_browsing_threats),
    updated_at           = now()
  WHERE id = v_edit.app_id;

  UPDATE public.app_edits SET
    status      = 'approved',
    reviewed_by = v_caller,
    reviewed_at = now()
  WHERE id = p_edit_id;

  RETURN v_edit.app_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_app_edit(uuid, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_app_edit(uuid, boolean, text[]) TO authenticated;
