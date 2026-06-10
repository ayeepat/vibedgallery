-- Public bucket URLs are served via the CDN regardless of RLS;
-- the broad SELECT policy only enabled API-level enumeration.
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
