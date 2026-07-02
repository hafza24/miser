
CREATE OR REPLACE FUNCTION public.join_mood_room(p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.mood_rooms%ROWTYPE;
  v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_room FROM public.mood_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR NOT v_room.is_active THEN RAISE EXCEPTION 'Room not available'; END IF;

  IF v_room.mode = 'dark' AND NOT public.user_has_dark_access(v_uid) THEN
    RAISE EXCEPTION 'Dark Mode required for this room';
  END IF;

  -- Permanent room chat: create once, never rotate, never expire
  IF v_room.chat_id IS NULL THEN
    INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped, name, created_by, member_limit)
    VALUES (v_room.mode, true, NULL, true, v_room.emoji || ' ' || v_room.name, v_uid, 100)
    RETURNING id INTO v_chat_id;

    UPDATE public.mood_rooms
    SET chat_id = v_chat_id, chat_expires_at = NULL
    WHERE id = p_room_id;
  ELSE
    v_chat_id := v_room.chat_id;
    -- Ensure existing chat is permanent
    UPDATE public.chats
    SET expires_at = NULL, timer_stopped = true
    WHERE id = v_chat_id AND (expires_at IS NOT NULL OR timer_stopped = false);
    UPDATE public.mood_rooms SET chat_expires_at = NULL WHERE id = p_room_id AND chat_expires_at IS NOT NULL;
  END IF;

  INSERT INTO public.chat_participants (chat_id, user_id, role)
  VALUES (v_chat_id, v_uid, 'member')
  ON CONFLICT (chat_id, user_id)
  DO UPDATE SET removed_at = NULL;

  RETURN v_chat_id;
END;
$function$;

-- Make all currently-tracked mood room chats permanent
UPDATE public.chats c
SET expires_at = NULL, timer_stopped = true
FROM public.mood_rooms m
WHERE m.chat_id = c.id;

UPDATE public.mood_rooms SET chat_expires_at = NULL WHERE chat_expires_at IS NOT NULL;
