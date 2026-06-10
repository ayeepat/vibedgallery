DROP POLICY IF EXISTS "Users can update own pending apps" ON public.apps;

CREATE POLICY "Users can update own pending apps"
ON public.apps
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status::text = 'pending_verification'
)
WITH CHECK (
  auth.uid() = user_id
  AND status::text IN ('pending_verification', 'pending_review')
);
