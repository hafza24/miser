
CREATE OR REPLACE FUNCTION public.delete_ended_chat(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_group boolean;
  v_active_count int;
  v_was_participant boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_group INTO v_is_group FROM public.chats WHERE id = p_chat_id;
  IF v_is_group IS NULL THEN RETURN; END IF;
  IF v_is_group THEN RAISE EXCEPTION 'Not a 1:1 chat'; END IF;

  -- Ensure caller was a participant (active or removed)
  SELECT EXISTS(
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = v_uid
  ) INTO v_was_participant;
  IF NOT v_was_participant THEN RAISE EXCEPTION 'Not a participant'; END IF;

  -- Only allow deletion if the chat has effectively ended (fewer than 2 active participants)
  SELECT count(*) INTO v_active_count
  FROM public.chat_participants
  WHERE chat_id = p_chat_id AND removed_at IS NULL;

  IF v_active_count >= 2 THEN
    RAISE EXCEPTION 'Chat still active';
  END IF;

  DELETE FROM public.messages WHERE chat_id = p_chat_id;
  DELETE FROM public.timer_stop_requests WHERE chat_id = p_chat_id;
  DELETE FROM public.chat_participants WHERE chat_id = p_chat_id;
  DELETE FROM public.chats WHERE id = p_chat_id;
END $$;

GRANT EXECUTE ON FUNCTION public.delete_ended_chat(uuid) TO authenticated;
