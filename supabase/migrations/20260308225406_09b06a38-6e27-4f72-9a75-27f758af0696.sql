
CREATE TABLE public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

-- Sender can view their outgoing requests
CREATE POLICY "Users can view their sent requests"
  ON public.chat_requests FOR SELECT
  USING (sender_id = auth.uid());

-- Receiver can view their incoming requests
CREATE POLICY "Users can view their received requests"
  ON public.chat_requests FOR SELECT
  USING (receiver_id = auth.uid());

-- Authenticated users can send requests
CREATE POLICY "Users can send chat requests"
  ON public.chat_requests FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Receiver can update (accept/decline)
CREATE POLICY "Receiver can respond to requests"
  ON public.chat_requests FOR UPDATE
  USING (receiver_id = auth.uid());

-- Sender can delete their own pending requests
CREATE POLICY "Sender can cancel requests"
  ON public.chat_requests FOR DELETE
  USING (sender_id = auth.uid() AND status = 'pending');
