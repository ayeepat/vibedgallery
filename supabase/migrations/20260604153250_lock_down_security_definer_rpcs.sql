-- These functions are called from triggers or rare admin paths only.
-- Revoke direct REST access so they can't be invoked via /rest/v1/rpc/.
REVOKE EXECUTE ON FUNCTION public.enforce_apps_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_apps_submitter_email() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_app_upvote_counter() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
-- get_app_submitter_email is intentionally callable: its body gates on
-- auth.uid() being the owner or admin (verified). Leave it alone.
