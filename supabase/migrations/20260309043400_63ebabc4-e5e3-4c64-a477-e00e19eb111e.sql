
-- Table for mode switch requests (light->dark needs consent)
CREATE TABLE public.mode_switch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  target_mode text NOT NULL DEFAULT 'dark',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mode_switch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create mode switch requests"
  ON public.mode_switch_requests FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND is_chat_participant(auth.uid(), chat_id));

CREATE POLICY "Users can view mode switch requests in their chats"
  ON public.mode_switch_requests FOR SELECT
  USING (is_chat_participant(auth.uid(), chat_id));

CREATE POLICY "Users can respond to mode switch requests"
  ON public.mode_switch_requests FOR UPDATE
  USING (is_chat_participant(auth.uid(), chat_id) AND sender_id <> auth.uid());

CREATE POLICY "Service role can delete mode switch requests"
  ON public.mode_switch_requests FOR DELETE
  USING (true);

-- Enable realtime for mode_switch_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.mode_switch_requests;
