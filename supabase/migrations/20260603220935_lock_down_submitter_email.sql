-- Goal: stop leaking submitter_email via the public API.
--
-- Strategy:
--  1. Server-side trigger fills submitter_email from auth.users at insert time;
--     the client no longer needs to (and no longer can) write it.
--  2. Revoke SELECT/INSERT/UPDATE on the submitter_email column from anon and
--     authenticated. PostgREST will quietly omit the column from `select *`
--     responses for those roles.
--  3. SECURITY DEFINER RPC lets the row owner (or an admin) read the email
--     deliberately when they need it (e.g. Admin panel).

CREATE OR REPLACE FUNCTION public.set_apps_submitter_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT email INTO NEW.submitter_email
  FROM auth.users
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apps_set_submitter_email ON public.apps;

CREATE TRIGGER apps_set_submitter_email
BEFORE INSERT ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.set_apps_submitter_email();

REVOKE SELECT (submitter_email), INSERT (submitter_email), UPDATE (submitter_email)
ON public.apps FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_app_submitter_email(target_app_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
  out_email text;
BEGIN
  IF caller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.submitter_email
    INTO out_email
  FROM public.apps a
  WHERE a.id = target_app_id
    AND (
      a.user_id = caller
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = caller AND role::text = 'admin'
      )
    );

  RETURN out_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_submitter_email(uuid) TO authenticated;
