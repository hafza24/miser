DROP POLICY "Sender can cancel requests" ON public.chat_requests;
CREATE POLICY "Sender can cancel requests"
ON public.chat_requests
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());