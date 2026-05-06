
-- Realtime channel authorization: restrict private topics to authorized users.
-- This adds a SELECT policy on realtime.messages so users can only receive
-- broadcast/presence on channels they are authorized for.

-- Allow generic / non-sensitive topics, and gate sensitive ones by membership.
CREATE POLICY "Authorize realtime channel subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    -- Private call signaling channels: must be a participant of the call
    WHEN realtime.topic() LIKE 'call:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 6))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'voice-activity:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 16))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-reactions:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 16))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-status:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 13))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-status-%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 13))::uuid,
        auth.uid()
      )
    -- Typing indicator channels: must be a conversation participant
    WHEN realtime.topic() LIKE 'typing:%'
      THEN public.is_conversation_participant(
        (substring(realtime.topic() from 8))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'conversation-%'
      THEN public.is_conversation_participant(
        (substring(realtime.topic() from 14))::uuid,
        auth.uid()
      )
    -- Generic, non-sensitive shared topics (postgres_changes filtered by underlying table RLS)
    WHEN realtime.topic() IN (
      'online-users',
      'moments-changes',
      'streams-changes',
      'community-membership-changes',
      'new-messages',
      'unread-messages',
      'global-incoming-calls',
      'calls-channel'
    ) THEN true
    -- Reaction channels (per-message); underlying table RLS still applies
    WHEN realtime.topic() LIKE 'reactions-%' THEN true
    ELSE false
  END
);

-- Also gate broadcast sends with the same rule
CREATE POLICY "Authorize realtime channel publishes"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'call:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 6))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'voice-activity:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 16))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-reactions:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 16))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-status:%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 13))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'call-status-%'
      THEN public.is_call_participant(
        (substring(realtime.topic() from 13))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'typing:%'
      THEN public.is_conversation_participant(
        (substring(realtime.topic() from 8))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'conversation-%'
      THEN public.is_conversation_participant(
        (substring(realtime.topic() from 14))::uuid,
        auth.uid()
      )
    WHEN realtime.topic() IN (
      'online-users',
      'moments-changes',
      'streams-changes',
      'community-membership-changes',
      'new-messages',
      'unread-messages',
      'global-incoming-calls',
      'calls-channel'
    ) THEN true
    WHEN realtime.topic() LIKE 'reactions-%' THEN true
    ELSE false
  END
);
