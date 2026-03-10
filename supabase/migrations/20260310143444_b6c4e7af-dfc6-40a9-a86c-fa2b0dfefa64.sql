
-- Fix 1: Prevent users from self-granting premium/enterprise subscriptions
-- Only allow inserting 'free' plan_type. Paid plans must be set by backend/admin.
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can insert their own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id AND plan_type = 'free');

DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND plan_type = 'free');

-- Fix 2: Prevent conversation members from self-promoting to admin
-- Only allow updating is_muted column, not is_admin
DROP POLICY IF EXISTS "Users can update their own participant settings" ON public.conversation_participants;
CREATE POLICY "Users can update their own participant settings"
ON public.conversation_participants
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND is_admin = (SELECT cp.is_admin FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid())
);
