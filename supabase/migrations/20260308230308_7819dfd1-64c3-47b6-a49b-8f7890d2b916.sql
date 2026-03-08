
-- Tighten the chat_participants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert participants" ON public.chat_participants;

-- Only allow inserting if the user is adding themselves, OR if they are a participant in the chat already
CREATE POLICY "Users can add participants to their chats"
ON public.chat_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_chat_participant(auth.uid(), chat_id)
);
