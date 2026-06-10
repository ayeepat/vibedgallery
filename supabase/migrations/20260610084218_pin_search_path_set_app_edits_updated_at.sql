-- Advisor: function_search_path_mutable. The trigger body only touches NEW
-- and now() (pg_catalog), so an empty search_path is safe and closes the
-- search-path-hijack class entirely.

ALTER FUNCTION public.set_app_edits_updated_at() SET search_path = '';
