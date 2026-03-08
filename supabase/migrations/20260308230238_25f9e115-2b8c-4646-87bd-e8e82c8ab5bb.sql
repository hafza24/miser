
-- Create a security definer function to check chat participation without triggering RLS
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE user_id = _user_id AND chat_id = _chat_id
  )
$$;

-- Drop the recursive SELECT policy on chat_participants
DROP POLICY IF EXISTS "Users can view their participations" ON public.chat_participants;

-- Create a simple non-recursive SELECT policy
CREATE POLICY "Users can view their participations"
ON public.chat_participants FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Also allow users to see other participants in their chats
CREATE POLICY "Users can view co-participants"
ON public.chat_participants FOR SELECT
TO authenticated
USING (public.is_chat_participant(auth.uid(), chat_id));

-- Fix chats SELECT policy to use the security definer function
DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.chats;

CREATE POLICY "Users can view chats they participate in"
ON public.chats FOR SELECT
TO authenticated
USING (public.is_chat_participant(auth.uid(), id));

-- Fix messages policies to use the security definer function
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_chat_participant(auth.uid(), chat_id));

DROP POLICY IF EXISTS "Users can send messages to their chats" ON public.messages;
CREATE POLICY "Users can send messages to their chats"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(auth.uid(), chat_id));

-- Fix chat_participants INSERT policy to be permissive
DROP POLICY IF EXISTS "Authenticated users can join chats" ON public.chat_participants;
CREATE POLICY "Authenticated users can insert participants"
ON public.chat_participants FOR INSERT
TO authenticated
WITH CHECK (true);
