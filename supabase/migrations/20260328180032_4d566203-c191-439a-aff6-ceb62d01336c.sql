-- 1. Remove user UPDATE on subscriptions entirely (upgrades should only happen via service role)
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;

-- 2. Restrict INSERT on conversation_participants to admins or self-joining
DROP POLICY IF EXISTS "Authenticated users can add participants to conversations" ON public.conversation_participants;

CREATE POLICY "Admins can add participants to conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  OR
  (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.is_admin = true
    )
  )
);