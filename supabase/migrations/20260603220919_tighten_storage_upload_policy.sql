-- Tighten the upload policy: the first folder segment of the object name must
-- equal the uploader's auth.uid(). This matches the existing client code which
-- uploads to "{userId}/{folder}/{file}".

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
