
-- Drop the overly permissive policy and replace with a scoped one
DROP POLICY "Authenticated users can create chats" ON public.chats;
CREATE POLICY "Authenticated users can create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_suspended = false)
);
