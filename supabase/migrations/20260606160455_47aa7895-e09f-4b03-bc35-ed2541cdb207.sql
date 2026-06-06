
-- 1. Plan-level access columns
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS daily_group_limit int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presence_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_translate_access boolean NOT NULL DEFAULT false;

-- Give existing plans reasonable defaults
UPDATE public.subscription_plans SET daily_group_limit = GREATEST(daily_group_limit, 5),
  presence_access = true, auto_translate_access = true
  WHERE is_active = true;

-- 2. Global admin feature toggles + free-tier defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('free_daily_chat_limit', to_jsonb(3)),
  ('free_daily_group_limit', to_jsonb(1)),
  ('free_daily_scene_limit', to_jsonb(0)),
  ('free_presence_access', to_jsonb(false)),
  ('free_auto_translate_access', to_jsonb(false)),
  ('presence_feature_enabled', to_jsonb(true)),
  ('auto_translate_feature_enabled', to_jsonb(true)),
  ('group_max_members', to_jsonb(8))
ON CONFLICT (key) DO NOTHING;

-- 3. Effective per-user limit helpers
CREATE OR REPLACE FUNCTION public.effective_daily_chat_limit(_uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.daily_chat_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id = _uid AND s.status='active' AND s.expiry_date > now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_daily_chat_limit'),
    3
  )
$$;

CREATE OR REPLACE FUNCTION public.effective_daily_group_limit(_uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.daily_group_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_daily_group_limit'),
    1
  )
$$;

CREATE OR REPLACE FUNCTION public.effective_daily_scene_limit(_uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sp.daily_scene_limit FROM public.subscriptions s
       JOIN public.subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
       ORDER BY sp.sort_order DESC LIMIT 1),
    (SELECT (value)::text::int FROM public.app_settings WHERE key='free_daily_scene_limit'),
    0
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_presence_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT (value)::text::boolean FROM public.app_settings WHERE key='presence_feature_enabled'), true)
    AND COALESCE(
      (SELECT sp.presence_access FROM public.subscriptions s
         JOIN public.subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
         ORDER BY sp.sort_order DESC LIMIT 1),
      (SELECT (value)::text::boolean FROM public.app_settings WHERE key='free_presence_access'),
      false
    )
$$;

CREATE OR REPLACE FUNCTION public.user_has_auto_translate_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT (value)::text::boolean FROM public.app_settings WHERE key='auto_translate_feature_enabled'), true)
    AND COALESCE(
      (SELECT sp.auto_translate_access FROM public.subscriptions s
         JOIN public.subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id=_uid AND s.status='active' AND s.expiry_date>now()
         ORDER BY sp.sort_order DESC LIMIT 1),
      (SELECT (value)::text::boolean FROM public.app_settings WHERE key='free_auto_translate_access'),
      false
    )
$$;

-- 4. Replace check_daily_chat_limit to use effective limit
CREATE OR REPLACE FUNCTION public.check_daily_chat_limit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM chat_participants cp
    JOIN chats c ON c.id = cp.chat_id
    WHERE cp.user_id = _user_id
      AND c.created_at >= (now() AT TIME ZONE 'UTC')::date
  ) < public.effective_daily_chat_limit(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.check_daily_group_limit(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM public.group_requests
    WHERE creator_id = _uid AND created_at >= (now() AT TIME ZONE 'UTC')::date
  ) < public.effective_daily_group_limit(_uid)
$$;

-- 5. Rewrite create_group_request: allow free tier (quota gated), enforce max members from admin
CREATE OR REPLACE FUNCTION public.create_group_request(p_type group_request_type, p_member_limit integer, p_gender_requirements jsonb, p_topic text, p_mode mode_preference DEFAULT 'light')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid; v_total int;
  v_allowed jsonb; v_require_approval boolean;
  v_group_max int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_feature_enabled() THEN RAISE EXCEPTION 'Group requests are currently disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=v_uid AND receive_group_invites=true) THEN
    RAISE EXCEPTION 'Enable "Receive Group Invitations" in Settings first';
  END IF;
  SELECT COALESCE((value)::text::int, 8) INTO v_group_max FROM public.app_settings WHERE key='group_max_members';
  IF p_member_limit > v_group_max THEN RAISE EXCEPTION 'Group size exceeds admin limit (% max)', v_group_max; END IF;
  v_total := COALESCE((p_gender_requirements->>'men')::int,0)+COALESCE((p_gender_requirements->>'women')::int,0)+COALESCE((p_gender_requirements->>'any')::int,0);
  IF v_total <> p_member_limit THEN RAISE EXCEPTION 'Gender composition must sum to member limit'; END IF;
  SELECT value INTO v_allowed FROM public.app_settings WHERE key='group_allowed_topics';
  IF v_allowed IS NOT NULL AND NOT (v_allowed ? p_topic) THEN RAISE EXCEPTION 'Topic not allowed'; END IF;
  IF NOT public.check_daily_group_limit(v_uid) THEN
    RAISE EXCEPTION 'Daily group creation limit reached (%/day)', public.effective_daily_group_limit(v_uid);
  END IF;
  SELECT COALESCE((value)::text::boolean,false) INTO v_require_approval FROM public.app_settings WHERE key='group_require_admin_approval';
  INSERT INTO public.group_requests (creator_id,type,member_limit,gender_requirements,topic,mode,status)
  VALUES (v_uid,p_type,p_member_limit,p_gender_requirements,p_topic,p_mode,
    CASE WHEN v_require_approval THEN 'pending_review'::public.group_request_status ELSE 'open'::public.group_request_status END)
  RETURNING id INTO v_id;
  INSERT INTO public.group_participants (request_id,user_id,join_status,gender_slot)
  VALUES (v_id,v_uid,'approved',(SELECT COALESCE(gender,'any') FROM public.profiles WHERE user_id=v_uid));
  RETURN v_id;
END $$;

-- Also relax join_group_request: no premium gate (anyone with receive_group_invites can join)
CREATE OR REPLACE FUNCTION public.join_group_request(p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_req public.group_requests%ROWTYPE;
  v_gender text; v_slot text;
  v_men_taken int; v_women_taken int; v_any_taken int;
  v_men_need int; v_women_need int; v_any_need int;
  v_total_taken int; v_chat_id uuid;
  v_require_approval boolean; v_initial public.group_join_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_feature_enabled() THEN RAISE EXCEPTION 'Group requests are currently disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=v_uid AND receive_group_invites=true) THEN
    RAISE EXCEPTION 'Enable "Receive Group Invitations" in Settings to join groups';
  END IF;
  SELECT * INTO v_req FROM public.group_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'open' THEN RAISE EXCEPTION 'Request is not open'; END IF;
  IF v_req.creator_id = v_uid THEN RAISE EXCEPTION 'You created this request'; END IF;
  IF v_req.expires_at < now() THEN RAISE EXCEPTION 'Request expired'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_participants WHERE request_id=p_request_id AND user_id=v_uid AND join_status IN ('approved','pending')) THEN
    RAISE EXCEPTION 'Already joined or pending';
  END IF;
  SELECT COALESCE(gender,'any') INTO v_gender FROM public.profiles WHERE user_id=v_uid;
  v_men_need := COALESCE((v_req.gender_requirements->>'men')::int,0);
  v_women_need := COALESCE((v_req.gender_requirements->>'women')::int,0);
  v_any_need := COALESCE((v_req.gender_requirements->>'any')::int,0);
  SELECT count(*) FILTER (WHERE gender_slot='men'),
         count(*) FILTER (WHERE gender_slot='women'),
         count(*) FILTER (WHERE gender_slot='any')
  INTO v_men_taken,v_women_taken,v_any_taken
  FROM public.group_participants WHERE request_id=p_request_id AND join_status='approved';
  IF v_gender='male' AND v_men_taken<v_men_need THEN v_slot:='men';
  ELSIF v_gender='female' AND v_women_taken<v_women_need THEN v_slot:='women';
  ELSIF v_any_taken<v_any_need THEN v_slot:='any';
  ELSE RAISE EXCEPTION 'No matching gender slot available'; END IF;
  SELECT COALESCE((value)::text::boolean,false) INTO v_require_approval FROM public.app_settings WHERE key='group_require_admin_approval';
  v_initial := CASE WHEN v_require_approval THEN 'pending' ELSE 'approved' END;
  INSERT INTO public.group_participants (request_id,user_id,join_status,gender_slot)
  VALUES (p_request_id,v_uid,v_initial,v_slot);
  IF v_initial='approved' THEN
    SELECT count(*) INTO v_total_taken FROM public.group_participants WHERE request_id=p_request_id AND join_status='approved';
    IF v_total_taken >= v_req.member_limit THEN
      INSERT INTO public.chats (mode,is_group,expires_at,timer_stopped)
      VALUES (v_req.mode,true,now()+interval '7 days',true) RETURNING id INTO v_chat_id;
      INSERT INTO public.chat_participants (chat_id,user_id)
      SELECT v_chat_id,gp.user_id FROM public.group_participants gp
      WHERE gp.request_id=p_request_id AND gp.join_status='approved';
      UPDATE public.group_requests SET status='filled', chat_id=v_chat_id WHERE id=p_request_id;
      RETURN v_chat_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Same relax for list_eligible_group_requests (drop premium gate)
CREATE OR REPLACE FUNCTION public.list_eligible_group_requests()
RETURNS SETOF group_requests LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_gender text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT public.group_feature_enabled() THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=v_uid AND receive_group_invites=true) THEN RETURN; END IF;
  SELECT COALESCE(gender,'any') INTO v_gender FROM public.profiles WHERE user_id=v_uid;
  RETURN QUERY
  SELECT gr.* FROM public.group_requests gr
  WHERE gr.status='open' AND gr.expires_at>now() AND gr.creator_id<>v_uid
    AND NOT EXISTS (SELECT 1 FROM public.group_participants gp WHERE gp.request_id=gr.id AND gp.user_id=v_uid AND gp.join_status IN ('approved','pending'))
    AND (
      (v_gender='male' AND COALESCE((gr.gender_requirements->>'men')::int,0) > (SELECT count(*) FROM public.group_participants WHERE request_id=gr.id AND gender_slot='men' AND join_status='approved'))
      OR (v_gender='female' AND COALESCE((gr.gender_requirements->>'women')::int,0) > (SELECT count(*) FROM public.group_participants WHERE request_id=gr.id AND gender_slot='women' AND join_status='approved'))
      OR (COALESCE((gr.gender_requirements->>'any')::int,0) > (SELECT count(*) FROM public.group_participants WHERE request_id=gr.id AND gender_slot='any' AND join_status='approved'))
    )
  ORDER BY gr.created_at DESC LIMIT 100;
END $$;
