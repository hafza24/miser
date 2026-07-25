
-- Concurrent active chat cap (1:1 chats)
INSERT INTO public.app_settings(key, value) VALUES ('max_active_chats', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.effective_max_active_chats(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT (value#>>'{}')::int FROM public.app_settings WHERE key='max_active_chats'),
    5
  );
$$;

CREATE OR REPLACE FUNCTION public.active_chat_count(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT count(*)::int
  FROM public.chat_participants cp
  JOIN public.chats c ON c.id = cp.chat_id
  WHERE cp.user_id = _uid
    AND cp.removed_at IS NULL
    AND c.is_group = false
    AND (c.expires_at IS NULL OR c.expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.check_active_chat_cap(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.active_chat_count(_uid) < public.effective_max_active_chats(_uid);
$$;

REVOKE EXECUTE ON FUNCTION public.effective_max_active_chats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.active_chat_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_active_chat_cap(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_max_active_chats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.active_chat_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_active_chat_cap(uuid) TO authenticated;

-- Enforce cap in accept_chat_request (both users must be under cap)
CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id uuid, p_mode mode_preference DEFAULT 'light'::mode_preference)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_request public.chat_requests%ROWTYPE;
  v_chat_id uuid;
  v_cap int;
BEGIN
  IF NOT public.check_daily_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Daily chat limit reached (%/day)', public.effective_daily_chat_limit(auth.uid());
  END IF;
  IF NOT public.check_monthly_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Monthly chat limit reached (%/month) — resets next month', public.effective_monthly_chat_limit(auth.uid());
  END IF;

  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.receiver_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed to accept this request'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;

  v_cap := public.effective_max_active_chats(auth.uid());
  IF public.active_chat_count(auth.uid()) >= v_cap THEN
    RAISE EXCEPTION 'You already have % active chats. End one before starting another.', v_cap;
  END IF;
  IF public.active_chat_count(v_request.sender_id) >= public.effective_max_active_chats(v_request.sender_id) THEN
    RAISE EXCEPTION 'The other user already has the maximum number of active chats.';
  END IF;

  INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped)
  VALUES (COALESCE(p_mode, 'light'), false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, v_request.receiver_id), (v_chat_id, v_request.sender_id);

  UPDATE public.chat_requests SET status = 'accepted' WHERE id = p_request_id;
  RETURN v_chat_id;
END;
$$;

-- Enforce cap in start_random_chat
CREATE OR REPLACE FUNCTION public.start_random_chat(p_mode mode_preference)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_other_user uuid;
  v_chat_id uuid;
  v_cap int;
BEGIN
  IF NOT public.check_daily_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Daily chat limit reached (%/day)', public.effective_daily_chat_limit(auth.uid());
  END IF;
  IF NOT public.check_monthly_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Monthly chat limit reached (%/month) — resets next month', public.effective_monthly_chat_limit(auth.uid());
  END IF;

  v_cap := public.effective_max_active_chats(auth.uid());
  IF public.active_chat_count(auth.uid()) >= v_cap THEN
    RAISE EXCEPTION 'You already have % active chats. End one before starting another.', v_cap;
  END IF;

  v_other_user := public.find_random_user(p_mode);
  IF v_other_user IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped)
  VALUES (p_mode, false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, auth.uid()), (v_chat_id, v_other_user);

  RETURN v_chat_id;
END;
$$;

-- Block sending a new chat request when sender is already at cap
CREATE OR REPLACE FUNCTION public.enforce_active_chat_cap_on_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cap int;
BEGIN
  v_cap := public.effective_max_active_chats(NEW.sender_id);
  IF public.active_chat_count(NEW.sender_id) >= v_cap THEN
    RAISE EXCEPTION 'You already have % active chats. End one before starting another.', v_cap;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_active_chat_cap_on_request ON public.chat_requests;
CREATE TRIGGER trg_active_chat_cap_on_request
  BEFORE INSERT ON public.chat_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_chat_cap_on_request();
