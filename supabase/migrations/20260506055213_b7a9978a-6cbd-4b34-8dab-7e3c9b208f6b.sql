
-- Fix 1: Tighten moments storage SELECT policy to require contact relationship (mirroring moments table RLS)
DROP POLICY IF EXISTS "Authenticated users can view non-expired moment media" ON storage.objects;

CREATE POLICY "Authenticated users can view non-expired moment media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'moments'
  AND (
    -- Owner can always view their own files
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Other viewers must (a) have a non-expired moment record for that owner AND (b) be a contact of the owner
    EXISTS (
      SELECT 1
      FROM public.moments m
      WHERE (m.user_id)::text = (storage.foldername(objects.name))[1]
        AND m.expires_at > now()
        AND EXISTS (
          SELECT 1 FROM public.contacts c
          WHERE c.user_id = auth.uid()
            AND c.contact_user_id = m.user_id
        )
    )
  )
);

-- Fix 2: Verify call participation on call_recordings INSERT
DROP POLICY IF EXISTS "Users can insert their own recordings" ON public.call_recordings;

CREATE POLICY "Users can insert their own recordings"
ON public.call_recordings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_call_participant(call_id, auth.uid())
);
