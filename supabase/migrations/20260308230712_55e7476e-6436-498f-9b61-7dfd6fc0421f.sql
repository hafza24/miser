
-- Add expires_at and timer_stopped to chats
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS timer_stopped boolean NOT NULL DEFAULT false;

-- Create timer_stop_requests table
CREATE TABLE IF NOT EXISTS public.timer_stop_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.timer_stop_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view timer requests in their chats"
ON public.timer_stop_requests FOR SELECT
TO authenticated
USING (public.is_chat_participant(auth.uid(), chat_id));

CREATE POLICY "Users can create timer stop requests"
ON public.timer_stop_requests FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(auth.uid(), chat_id));

CREATE POLICY "Users can respond to timer stop requests"
ON public.timer_stop_requests FOR UPDATE
TO authenticated
USING (public.is_chat_participant(auth.uid(), chat_id) AND sender_id != auth.uid());

-- Allow updating chats for timer
CREATE POLICY "Participants can update chat timer"
ON public.chats FOR UPDATE
TO authenticated
USING (public.is_chat_participant(auth.uid(), id));

-- Enable realtime for timer_stop_requests (messages already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.timer_stop_requests;
