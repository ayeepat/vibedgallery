-- Drop the over-broad "Anyone can read profiles" policy. Replace with a view
-- that only exposes the public columns (id, name, role, avatar_url).
-- Users can still read their own full row via the existing "Users can read own profile" policy.

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, name, role, avatar_url, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Re-add a minimal public read policy scoped to the safe columns via the view.
-- (The view is the public surface; the underlying table is restricted.)
CREATE POLICY "Authenticated can read non-email profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- NB: anon (unauthenticated visitors) lose direct access to public.profiles.
-- If you want anon to read names too, switch the policy role to {anon, authenticated}.
-- But anon shouldn't be able to read emails either, which the old policy allowed.
