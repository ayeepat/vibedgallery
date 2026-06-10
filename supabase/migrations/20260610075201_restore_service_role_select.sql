-- send-email Edge Function runs as service_role and reads apps (incl.
-- submitter_email), profiles.role and app_edits. The column-level lockdown
-- (lock_down_submitter_email_v2) stripped service_role of SELECT on every
-- public table, so all email types 500'd with "permission denied for table
-- apps". service_role never reaches browsers and bypasses RLS by design;
-- this only restores trusted reads.

GRANT SELECT ON public.apps TO service_role;
GRANT SELECT ON public.app_edits TO service_role;
GRANT SELECT ON public.profiles TO service_role;
