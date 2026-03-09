
CREATE OR REPLACE FUNCTION public.check_daily_chat_limit(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT (
    SELECT count(*)
    FROM chat_participants cp
    JOIN chats c ON c.id = cp.chat_id
    WHERE cp.user_id = _user_id
      AND c.created_at >= (now() AT TIME ZONE 'UTC')::date
  ) < 3
$$;

---

CREATE OR REPLACE FUNCTION public.start_random_chat(p_mode mode_preference)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_other_user uuid;
  v_chat_id uuid;
BEGIN
  IF NOT check_daily_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Daily chat limit reached (3 chats per day)';
  END IF;

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
$function$;

---

CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id uuid, p_mode mode_preference DEFAULT 'light'::mode_preference)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.chat_requests%ROWTYPE;
  v_chat_id uuid;
BEGIN
  IF NOT check_daily_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Daily chat limit reached (3 chats per day)';
  END IF;

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
$function$;
