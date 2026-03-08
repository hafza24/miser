
CREATE OR REPLACE FUNCTION public.find_random_user(p_mode mode_preference)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT p.user_id INTO v_user_id
  FROM profiles p
  WHERE p.user_id <> auth.uid()
    AND p.mode_preference = p_mode
    AND p.is_suspended = false
    AND NOT EXISTS (
      SELECT 1 FROM chat_requests cr
      WHERE ((cr.sender_id = auth.uid() AND cr.receiver_id = p.user_id)
         OR (cr.sender_id = p.user_id AND cr.receiver_id = auth.uid()))
        AND cr.status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_participants cp1
      JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
      JOIN chats c ON c.id = cp1.chat_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = p.user_id
        AND (c.timer_stopped = true OR c.expires_at > now())
    )
  ORDER BY random()
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_random_user(mode_preference) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_random_user(mode_preference) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_random_chat(p_mode mode_preference)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_user uuid;
  v_chat_id uuid;
BEGIN
  v_other_user := find_random_user(p_mode);
  
  IF v_other_user IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO chats (mode, is_group, expires_at, timer_stopped)
  VALUES (p_mode, false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;
  
  INSERT INTO chat_participants (chat_id, user_id)
  VALUES (v_chat_id, auth.uid()), (v_chat_id, v_other_user);
  
  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_random_chat(mode_preference) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_random_chat(mode_preference) TO authenticated;
