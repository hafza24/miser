-- Allow message senders to delete their own messages (used by Delete-for-Everyone)
CREATE POLICY "Senders can delete their own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());