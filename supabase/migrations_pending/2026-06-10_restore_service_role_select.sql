-- FIX (high priority): send-email Edge Function is broken in production.
--
-- The column-level lockdown that revoked table privileges on public.apps /
-- app_edits / profiles also stripped service_role of SELECT (it currently has
-- only REFERENCES/TRIGGER/TRUNCATE on every public table). send-email creates
-- a service-role client and reads apps (incl. submitter_email), profiles.role
-- and app_edits — so every email type now 500s with "permission denied for
-- table apps" (confirmed in postgres + edge-function logs, 2026-06-09).
-- Emails are fire-and-forget client-side, so this fails silently: no
-- submission confirmations, no admin notifications, no approved/rejected
-- emails, no report alerts.
--
-- service_role is never exposed to browsers and already bypasses RLS by
-- design; restoring SELECT here only lets the trusted edge functions read
-- again. anon/authenticated grants are untouched.

GRANT SELECT ON public.apps TO service_role;
GRANT SELECT ON public.app_edits TO service_role;
GRANT SELECT ON public.profiles TO service_role;
