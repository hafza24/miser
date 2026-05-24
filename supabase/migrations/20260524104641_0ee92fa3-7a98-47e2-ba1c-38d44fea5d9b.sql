
-- 1) Tighten chat_participants INSERT policy: remove unconditional self-add
DROP POLICY IF EXISTS "Users can join via request or self-add" ON public.chat_participants;

CREATE POLICY "Users can join chats via accepted request"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_requests cr
    JOIN public.chat_participants cp_other
      ON cp_other.chat_id = chat_participants.chat_id
     AND cp_other.user_id <> auth.uid()
    WHERE cr.status = 'accepted'
      AND (
        (cr.sender_id = auth.uid() AND cr.receiver_id = cp_other.user_id)
        OR
        (cr.receiver_id = auth.uid() AND cr.sender_id = cp_other.user_id)
      )
  )
);

-- 2) Restrict Realtime channel subscriptions to chat participants
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can receive realtime for their chats" ON realtime.messages;

CREATE POLICY "Participants can receive realtime for their chats"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow only when the topic is a chat the user participates in.
  -- Topics used by the app are the chat_id (uuid string). Fallback: allow
  -- topics that don't look like a chat id (e.g. presence/global channels)
  -- to remain accessible only if the user is authenticated.
  CASE
    WHEN realtime.topic() ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_chat_participant(auth.uid(), realtime.topic()::uuid)
    ELSE auth.uid() IS NOT NULL
  END
);
