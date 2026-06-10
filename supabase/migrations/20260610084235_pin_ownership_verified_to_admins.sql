-- Close the verified-badge spoof: owners could flip ownership_verified on
-- their own pending apps rows AND on their pending app_edits rows (the
-- UPDATE policies don't pin the column). The app_edits path was a real
-- exploit: apply_app_edit copies the edit's ownership_verified onto the live
-- app when the URL changed, so a self-set `true` + an admin approving
-- without re-checking yields a ✓ Verified badge on an unproven URL.
--
-- A BEFORE UPDATE trigger silently keeps the OLD value unless the caller is
-- an admin (per JWT) or a direct DB role (auth.uid() IS NULL — dashboard,
-- service_role, SQL editor). Admin client flows (handleRecheck/handleApprove)
-- and apply_app_edit (runs with the calling admin's JWT) are unaffected.
-- INSERTs are already pinned to false by the existing WITH CHECK policies.

CREATE OR REPLACE FUNCTION public.protect_ownership_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ownership_verified IS DISTINCT FROM OLD.ownership_verified THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    ) THEN
      NEW.ownership_verified := OLD.ownership_verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_ownership_verified() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apps_protect_ownership_verified ON public.apps;
CREATE TRIGGER apps_protect_ownership_verified
  BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.protect_ownership_verified();

DROP TRIGGER IF EXISTS app_edits_protect_ownership_verified ON public.app_edits;
CREATE TRIGGER app_edits_protect_ownership_verified
  BEFORE UPDATE ON public.app_edits
  FOR EACH ROW EXECUTE FUNCTION public.protect_ownership_verified();
