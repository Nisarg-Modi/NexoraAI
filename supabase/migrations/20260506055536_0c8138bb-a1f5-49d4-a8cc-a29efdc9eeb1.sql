
-- Replace permissive SELECT policies on public buckets with owner-scoped listing.
-- Public file access via /storage/v1/object/public/... continues to work because
-- public buckets bypass RLS for direct object reads. Only the listing endpoint
-- (which queries storage.objects via RLS) is now restricted.

DROP POLICY IF EXISTS "Anyone can view avatars public" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view stream media" ON storage.objects;

CREATE POLICY "Owners can list their avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can list their stream media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'stream-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
