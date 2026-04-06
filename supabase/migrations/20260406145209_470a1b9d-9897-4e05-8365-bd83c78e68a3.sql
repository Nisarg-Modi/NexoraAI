
-- 1. Fix expired moment media: restrict storage SELECT to authenticated users viewing non-expired moments
DROP POLICY IF EXISTS "Anyone can view moment media" ON storage.objects;

CREATE POLICY "Authenticated users can view non-expired moment media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'moments'
  AND (
    -- Owner can always see their own files
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Others can only see files for non-expired moments
    EXISTS (
      SELECT 1 FROM public.moments m
      WHERE m.user_id::text = (storage.foldername(name))[1]
        AND m.expires_at > now()
    )
  )
);

-- 2. Harden user_roles: add RESTRICTIVE policy to block all direct writes except service role
-- The existing permissive INSERT/DELETE policies check has_role('admin'), but adding a 
-- restrictive layer ensures no bypass is possible even if an edge function leaks credentials.
-- Since service_role bypasses RLS, legitimate admin operations via backend still work.
CREATE POLICY "Block direct user_roles modifications"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  -- Only allow reading own roles (already covered by permissive, but belt-and-suspenders)
  auth.uid() = user_id
)
WITH CHECK (
  -- Block all direct inserts/updates from authenticated users
  -- Admin operations should go through service role which bypasses RLS
  false
);
