DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;
CREATE POLICY "Authenticated users can create chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);