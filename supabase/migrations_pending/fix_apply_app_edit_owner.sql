-- Fix: apply_app_edit() still hits "permission denied for table apps" because
-- it's a SECURITY DEFINER function but its OWNER lacks UPDATE on the locked
-- columns (verification_token, safe_browsing_passed, safe_browsing_threats).
-- A SECURITY DEFINER function runs as its owner, not as the caller — so the
-- owner needs the grants, not `authenticated`.
--
-- The safe fix is to: (a) re-own the function to `postgres` (which always has
-- all privileges in Supabase), and (b) belt-and-braces GRANT the column-level
-- UPDATEs to `postgres` explicitly in case the project previously revoked
-- them. Run the whole block — both statements are idempotent.

ALTER FUNCTION public.apply_app_edit(uuid, boolean, text[]) OWNER TO postgres;

GRANT UPDATE (
  verification_token,
  ownership_verified,
  safe_browsing_passed,
  safe_browsing_threats,
  submitter_email
) ON public.apps TO postgres;
