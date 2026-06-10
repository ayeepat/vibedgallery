COMMENT ON TABLE public.view_throttle IS
  'Per-IP rate-limit log for increment_app_views. RLS is enabled with no policies on purpose — only SECURITY DEFINER functions (increment_app_views, cleanup_view_throttle) touch this table, and EXECUTE on those is granted explicitly. The advisor INFO "RLS Enabled No Policy" is intentional.';
