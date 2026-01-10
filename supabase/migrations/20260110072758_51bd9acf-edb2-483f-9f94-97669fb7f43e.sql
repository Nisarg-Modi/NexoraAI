-- Add verification column to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_verified boolean DEFAULT false;

-- Only admins can update verification status
CREATE POLICY "Admins can update verification status"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);