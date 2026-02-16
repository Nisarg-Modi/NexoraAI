
-- Fix 1: Tighten conversations INSERT policy (remove WITH CHECK (true))
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Fix 2: Add cleanup function for expired moments
CREATE OR REPLACE FUNCTION public.cleanup_expired_moments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete related data first
  DELETE FROM public.moment_views
  WHERE moment_id IN (SELECT id FROM public.moments WHERE expires_at < NOW());

  DELETE FROM public.moment_replies
  WHERE moment_id IN (SELECT id FROM public.moments WHERE expires_at < NOW());

  -- Delete expired moments
  DELETE FROM public.moments
  WHERE expires_at < NOW();
END;
$$;

-- Fix 3: Update moments SELECT policy to filter out expired moments
DROP POLICY IF EXISTS "Users can view moments from contacts and own" ON public.moments;

CREATE POLICY "Users can view moments from contacts and own"
ON public.moments
FOR SELECT
USING (
  expires_at > NOW() AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.user_id = auth.uid()
      AND contacts.contact_user_id = moments.user_id
    )
  )
);
