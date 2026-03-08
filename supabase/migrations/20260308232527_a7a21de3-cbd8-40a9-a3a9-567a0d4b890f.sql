DROP POLICY "Users can add participants to their chats" ON public.chat_participants;
CREATE POLICY "Users can add participants to their chats"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR is_chat_participant(auth.uid(), chat_id)
  OR EXISTS (
    SELECT 1 FROM public.chat_requests
    WHERE status = 'pending'
      AND receiver_id = auth.uid()
      AND sender_id = user_id
  )
);