-- app_edits: pending edits to an approved apps row, reviewed by an admin
-- before being applied to the live row. One pending edit per app at a time
-- (enforced by a partial unique index — see below).
--
-- Lifecycle:
--   pending_verification  → URL changed; user must redeploy verification file
--                            at the NEW URL before admin can approve
--   pending_review        → URL unchanged (or HTML already redeployed); waiting
--                            on admin
--   approved              → admin applied the edit to apps; historical record
--   rejected              → admin rejected; historical record
--
-- The live apps row is NEVER modified by an INSERT here; only by admin on
-- approval. Public gallery keeps showing the approved (old) content while an
-- edit is in flight, per design.

CREATE TABLE public.app_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Proposed values (mirror of the editable subset of apps schema)
  title varchar NOT NULL,
  tagline varchar NOT NULL,
  description text,
  url varchar NOT NULL,
  category varchar NOT NULL,
  tags text[],
  primary_tool varchar,
  other_tools varchar,
  demo_video_url varchar,
  thumbnail_url varchar,
  screenshot_urls text[],
  slug text,
  submitter_twitter varchar,
  submitter_github varchar,

  -- Edit lifecycle. Mirrors apps.status semantics so the admin queue UI can
  -- reuse the same status filters.
  status varchar NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_verification','pending_review','approved','rejected')),

  -- New HTML token issued when URL changed. Null when URL unchanged.
  verification_token varchar,
  ownership_verified boolean NOT NULL DEFAULT false,

  -- Safe Browsing re-check on the new URL (set at edit submission time).
  safe_browsing_passed boolean,
  safe_browsing_threats text[],

  -- Review
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One pending edit per app at a time. New edits REPLACE the previous pending
-- one (the EditApp page does DELETE-then-INSERT under one user_id). Historical
-- approved/rejected rows accumulate freely.
CREATE UNIQUE INDEX app_edits_one_pending_per_app
  ON public.app_edits(app_id)
  WHERE status IN ('pending_review','pending_verification');

CREATE INDEX app_edits_user_id_idx ON public.app_edits(user_id);
CREATE INDEX app_edits_status_idx ON public.app_edits(status);
CREATE INDEX app_edits_app_id_idx ON public.app_edits(app_id);

-- updated_at maintenance — mirrors the pattern other tables use.
CREATE OR REPLACE FUNCTION public.set_app_edits_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_edits_set_updated_at
  BEFORE UPDATE ON public.app_edits
  FOR EACH ROW EXECUTE FUNCTION public.set_app_edits_updated_at();

ALTER TABLE public.app_edits ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees their own edits, admin sees all. Public sees nothing.
CREATE POLICY app_edits_select ON public.app_edits
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- INSERT: only the app owner can propose an edit, and only against their own
-- approved app. Status must be one of the pending lifecycle states. The unique
-- partial index ensures at most one open edit per app.
CREATE POLICY app_edits_insert ON public.app_edits
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.apps
      WHERE id = app_id
        AND user_id = (SELECT auth.uid())
        AND status = 'approved'
    )
    AND status IN ('pending_verification','pending_review')
    AND COALESCE(ownership_verified, false) = false
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- UPDATE: owner can flip their own edit from pending_verification →
-- pending_review (after deploying the HTML at the new URL) and may set
-- ownership_verified. Admin can do anything. Owners cannot self-approve.
CREATE POLICY app_edits_update ON public.app_edits
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR (
      user_id = (SELECT auth.uid())
      AND status IN ('pending_verification','pending_review')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR (
      user_id = (SELECT auth.uid())
      AND status IN ('pending_verification','pending_review')
    )
  );

-- DELETE: owner can delete their own pending edit (used when replacing it).
-- Admin can delete anything.
CREATE POLICY app_edits_delete ON public.app_edits
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_edits TO authenticated;
