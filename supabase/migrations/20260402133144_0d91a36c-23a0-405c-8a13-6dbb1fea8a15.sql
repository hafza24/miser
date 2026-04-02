
-- Fix chat_participants INSERT policy: remove the dangerous is_chat_participant branch
DROP POLICY IF EXISTS "Users can add participants to their chats" ON public.chat_participants;

CREATE POLICY "Users can join via request or self-add"
ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM chat_requests
    WHERE status = 'pending'
      AND receiver_id = auth.uid()
      AND sender_id = chat_participants.user_id
  )
);
