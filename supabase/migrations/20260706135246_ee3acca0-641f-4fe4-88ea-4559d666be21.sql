
-- 1. Add monthly limit columns to subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_chat_limit integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS monthly_scene_limit integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS monthly_group_limit integer NOT NULL DEFAULT 10;

-- 2. Free-tier monthly defaults in app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('free_monthly_chat_limit', '20'::jsonb),
  ('free_monthly_scene_limit', '0'::jsonb),
  ('free_monthly_group_limit', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Effective monthly limit helpers (calendar month)
CREATE OR REPLACE FUNCTION public.effective_monthly_chat_limit(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.monthly_chat_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_monthly_chat_limit'),
    20
  )
$$;

CREATE OR REPLACE FUNCTION public.effective_monthly_scene_limit(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.monthly_scene_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_monthly_scene_limit'),
    0
  )
$$;

CREATE OR REPLACE FUNCTION public.effective_monthly_group_limit(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.monthly_group_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_monthly_group_limit'),
    3
  )
$$;

-- 4. Monthly usage check functions (calendar month, UTC)
CREATE OR REPLACE FUNCTION public.check_monthly_chat_limit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM public.chat_participants cp
    JOIN public.chats c ON c.id = cp.chat_id
    WHERE cp.user_id = _user_id
      AND c.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
  ) < public.effective_monthly_chat_limit(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.check_monthly_group_limit(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM public.group_requests
    WHERE creator_id = _uid
      AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
  ) < public.effective_monthly_group_limit(_uid)
$$;

-- 5. Enforce monthly in existing chat RPCs
CREATE OR REPLACE FUNCTION public.start_random_chat(p_mode mode_preference)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_other_user uuid;
  v_chat_id uuid;
BEGIN
  IF NOT public.check_daily_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Daily chat limit reached (%/day)', public.effective_daily_chat_limit(auth.uid());
  END IF;
  IF NOT public.check_monthly_chat_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Monthly chat limit reached (%/month) — resets next month', public.effective_monthly_chat_limit(auth.uid());
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

CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id uuid, p_mode mode_preference DEFAULT 'light'::mode_preference)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.chat_requests%ROWTYPE;
  v_chat_id uuid;
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

  INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped)
  VALUES (COALESCE(p_mode, 'light'), false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, v_request.receiver_id), (v_chat_id, v_request.sender_id);

  UPDATE public.chat_requests SET status = 'accepted' WHERE id = p_request_id;
  RETURN v_chat_id;
END;
$$;

-- 6. Enforce monthly group creation limits
CREATE OR REPLACE FUNCTION public.create_group_request_from_chat(p_chat_id uuid, p_type group_request_type, p_member_limit integer, p_gender_requirements jsonb, p_topic text, p_mode mode_preference DEFAULT 'light'::mode_preference)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_total int;
  v_allowed jsonb;
  v_require_approval boolean;
  v_group_max int;
  v_seed_count int;
  v_member record;
  v_gender text;
  v_slot text;
  v_men_need int;
  v_women_need int;
  v_any_need int;
  v_men_taken int := 0;
  v_women_taken int := 0;
  v_any_taken int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_feature_enabled() THEN RAISE EXCEPTION 'Group requests are currently disabled'; END IF;
  IF NOT public.is_chat_participant(v_uid, p_chat_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF EXISTS (SELECT 1 FROM public.chats WHERE id = p_chat_id AND is_group = true) THEN
    RAISE EXCEPTION 'This chat is already a group';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND receive_group_invites = true) THEN
    RAISE EXCEPTION 'Enable "Receive Group Invitations" in Settings first';
  END IF;
  IF NOT public.check_daily_group_limit(v_uid) THEN
    RAISE EXCEPTION 'Daily group creation limit reached (%/day)', public.effective_daily_group_limit(v_uid);
  END IF;
  IF NOT public.check_monthly_group_limit(v_uid) THEN
    RAISE EXCEPTION 'Monthly group creation limit reached (%/month) — resets next month', public.effective_monthly_group_limit(v_uid);
  END IF;

  SELECT count(*) INTO v_seed_count
  FROM public.chat_participants
  WHERE chat_id = p_chat_id AND removed_at IS NULL;
  IF v_seed_count < 2 THEN RAISE EXCEPTION 'This chat needs two active people before it can become a group request'; END IF;
  IF p_member_limit <= v_seed_count THEN RAISE EXCEPTION 'Group size must leave room for at least one new member'; END IF;

  SELECT COALESCE((value)::text::int, 8) INTO v_group_max FROM public.app_settings WHERE key = 'group_max_members';
  IF p_member_limit > COALESCE(v_group_max, 8) THEN RAISE EXCEPTION 'Group size exceeds admin limit (% max)', COALESCE(v_group_max, 8); END IF;

  v_men_need := COALESCE((p_gender_requirements->>'men')::int, 0);
  v_women_need := COALESCE((p_gender_requirements->>'women')::int, 0);
  v_any_need := COALESCE((p_gender_requirements->>'any')::int, 0);
  v_total := v_men_need + v_women_need + v_any_need;
  IF v_total <> p_member_limit THEN RAISE EXCEPTION 'Gender composition must sum to member limit'; END IF;

  SELECT value INTO v_allowed FROM public.app_settings WHERE key = 'group_allowed_topics';
  IF v_allowed IS NOT NULL AND NOT (v_allowed ? p_topic) THEN RAISE EXCEPTION 'Topic not allowed'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.group_seed_slots (
    user_id uuid PRIMARY KEY,
    gender_slot text NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.group_seed_slots;

  FOR v_member IN
    SELECT cp.user_id, COALESCE(p.gender, 'any') AS gender
    FROM public.chat_participants cp
    LEFT JOIN public.profiles p ON p.user_id = cp.user_id
    WHERE cp.chat_id = p_chat_id AND cp.removed_at IS NULL
    ORDER BY CASE WHEN cp.user_id = v_uid THEN 0 ELSE 1 END, cp.joined_at
  LOOP
    v_gender := v_member.gender;
    IF v_gender = 'male' AND v_men_taken < v_men_need THEN
      v_slot := 'men'; v_men_taken := v_men_taken + 1;
    ELSIF v_gender = 'female' AND v_women_taken < v_women_need THEN
      v_slot := 'women'; v_women_taken := v_women_taken + 1;
    ELSIF v_any_taken < v_any_need THEN
      v_slot := 'any'; v_any_taken := v_any_taken + 1;
    ELSE
      RAISE EXCEPTION 'Selected composition does not fit the people already in this chat';
    END IF;
    INSERT INTO pg_temp.group_seed_slots(user_id, gender_slot) VALUES (v_member.user_id, v_slot);
  END LOOP;

  SELECT COALESCE((value)::text::boolean, false) INTO v_require_approval
  FROM public.app_settings WHERE key = 'group_require_admin_approval';

  INSERT INTO public.group_requests (creator_id, type, member_limit, gender_requirements, topic, mode, status, source_chat_id)
  VALUES (
    v_uid, p_type, p_member_limit, p_gender_requirements, p_topic, p_mode,
    CASE WHEN v_require_approval THEN 'pending_review'::public.group_request_status ELSE 'open'::public.group_request_status END,
    p_chat_id
  ) RETURNING id INTO v_id;

  INSERT INTO public.group_participants (request_id, user_id, join_status, gender_slot)
  SELECT v_id, s.user_id, 'approved'::public.group_join_status, s.gender_slot
  FROM pg_temp.group_seed_slots s
  ON CONFLICT (request_id, user_id)
  DO UPDATE SET join_status = 'approved'::public.group_join_status,
                gender_slot = EXCLUDED.gender_slot,
                joined_at = now();

  PERFORM public.ensure_group_request_chat(v_id);
  RETURN v_id;
END $$;
