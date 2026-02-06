-- Drop the problematic policy causing infinite recursion
DROP POLICY IF EXISTS "Members can view community membership" ON public.community_members;

-- Create a simplified policy that doesn't recursively query community_members
-- Users can view their own memberships OR view memberships of communities they belong to
-- We break the recursion by using a security definer function
CREATE OR REPLACE FUNCTION public.is_community_member(community_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community_uuid AND user_id = user_uuid
  );
$$;

-- Create the new policy using the function
CREATE POLICY "Members can view community membership" 
ON public.community_members 
FOR SELECT 
USING (
  user_id = auth.uid() -- Can always see own memberships
  OR is_community_member(community_id, auth.uid()) -- Can see other members of same community
);