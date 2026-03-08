-- Accept chat request atomically without client-side multi-step RLS issues
CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id uuid, p_mode public.mode_preference DEFAULT 'light')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.chat_requests%ROWTYPE;
  v_chat_id uuid;
BEGIN
  SELECT *
  INTO v_request
  FROM public.chat_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.receiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to accept this request';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending';
  END IF;

  INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped)
  VALUES (COALESCE(p_mode, 'light'), false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES
    (v_chat_id, v_request.receiver_id),
    (v_chat_id, v_request.sender_id);

  UPDATE public.chat_requests
  SET status = 'accepted'
  WHERE id = p_request_id;

  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_chat_request(uuid, public.mode_preference) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_chat_request(uuid, public.mode_preference) TO authenticated;

-- Auto-delete stale chat requests after 24 hours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-expired-chat-requests'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-chat-requests',
      '*/15 * * * *',
      'DELETE FROM public.chat_requests WHERE created_at < now() - interval ''24 hours'';'
    );
  END IF;
END
$$;