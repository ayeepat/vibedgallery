-- 1) Replace every auth.uid() with (select auth.uid()) so it's evaluated
--    once per query instead of per row.
-- 2) Collapse overlapping permissive policies on apps + profiles into
--    single per-action policies.

-- ─── apps ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all apps"      ON public.apps;
DROP POLICY IF EXISTS "Anyone can view approved apps" ON public.apps;
DROP POLICY IF EXISTS "Users can view own apps"       ON public.apps;
DROP POLICY IF EXISTS "Admins can update apps"        ON public.apps;
DROP POLICY IF EXISTS "Users can update own pending apps" ON public.apps;
DROP POLICY IF EXISTS "Authenticated users can submit apps" ON public.apps;

CREATE POLICY "apps_select"
  ON public.apps FOR SELECT
  TO anon, authenticated
  USING (
    (status)::text = 'approved'
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid())
         AND role::text = 'admin'
    )
  );

CREATE POLICY "apps_insert"
  ON public.apps FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "apps_update"
  ON public.apps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid())
         AND role::text = 'admin'
    )
    OR ((SELECT auth.uid()) = user_id
        AND (status)::text = 'pending_verification')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid())
         AND role::text = 'admin'
    )
    OR ((SELECT auth.uid()) = user_id
        AND (status)::text = ANY (ARRAY['pending_verification','pending_review']))
  );

-- ─── profiles ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile"                        ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read non-email profile fields"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"                      ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"                      ON public.profiles;

-- Authenticated users get the public profile fields via the
-- public_profiles view (security_invoker), which selects from this table.
-- Email + private fields are filtered there. Anonymous users currently
-- have no SELECT need on profiles directly — the view handles maker
-- lookups for them too.
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_select_self_anon"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ─── upvotes ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upvote"      ON public.upvotes;
DROP POLICY IF EXISTS "Users can remove their own upvotes"  ON public.upvotes;

CREATE POLICY "upvotes_insert"
  ON public.upvotes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "upvotes_delete"
  ON public.upvotes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
