
-- ENUMS
DO $$ BEGIN CREATE TYPE public.group_request_type AS ENUM ('threesome','circle'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.group_request_status AS ENUM ('pending_review','open','filled','closed','rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.group_join_status AS ENUM ('pending','approved','rejected','left'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PROFILE OPT-IN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS receive_group_invites boolean NOT NULL DEFAULT false;

-- PLAN FLAG
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS group_requests_access boolean NOT NULL DEFAULT false;

-- TABLES (create both first, policies after)
CREATE TABLE IF NOT EXISTS public.group_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  type public.group_request_type NOT NULL,
  member_limit int NOT NULL CHECK (member_limit BETWEEN 3 AND 10),
  gender_requirements jsonb NOT NULL DEFAULT '{"any":0,"men":0,"women":0}'::jsonb,
  topic text NOT NULL,
  ai_scene_title text,
  ai_scene_description text,
  ai_icebreakers text[] DEFAULT '{}',
  mood_tags text[] DEFAULT '{}',
  status public.group_request_status NOT NULL DEFAULT 'open',
  chat_id uuid,
  admin_note text,
  mode public.mode_preference NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_group_requests_status ON public.group_requests(status);
CREATE INDEX IF NOT EXISTS idx_group_requests_creator ON public.group_requests(creator_id);

CREATE TABLE IF NOT EXISTS public.group_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.group_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  join_status public.group_join_status NOT NULL DEFAULT 'approved',
  gender_slot text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_participants_request ON public.group_participants(request_id);
CREATE INDEX IF NOT EXISTS idx_group_participants_user ON public.group_participants(user_id);

ALTER TABLE public.group_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_participants ENABLE ROW LEVEL SECURITY;

-- POLICIES: group_requests
CREATE POLICY "Creator can view own requests" ON public.group_requests FOR SELECT TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Admins manage all requests" ON public.group_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Creator can update own request" ON public.group_requests FOR UPDATE TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Participants can view their group request" ON public.group_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_participants gp WHERE gp.request_id = group_requests.id AND gp.user_id = auth.uid()));

-- POLICIES: group_participants
CREATE POLICY "Admins manage all participants" ON public.group_participants FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own participation" ON public.group_participants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Creator views participants" ON public.group_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_requests gr WHERE gr.id = group_participants.request_id AND gr.creator_id = auth.uid()));

-- APP SETTINGS DEFAULTS
INSERT INTO public.app_settings (key,value) VALUES
  ('group_requests_enabled','true'::jsonb),
  ('group_allowed_topics','["Friendship","Romance","Passionate","Fantasy","Deep conversation","Emotional support","Fun/social","Shared interests","Creative roleplay","Travel","Study","Gaming"]'::jsonb),
  ('group_daily_create_limit','3'::jsonb),
  ('group_require_admin_approval','false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- HELPERS
CREATE OR REPLACE FUNCTION public.user_has_group_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((
    SELECT sp.group_requests_access FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.user_id=_user_id AND s.status='active' AND s.expiry_date>now()
    ORDER BY sp.sort_order DESC LIMIT 1
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.group_feature_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.app_settings WHERE key='group_requests_enabled'), true)
$$;

-- CREATE
CREATE OR REPLACE FUNCTION public.create_group_request(
  p_type public.group_request_type,
  p_member_limit int,
  p_gender_requirements jsonb,
  p_topic text,
  p_mode public.mode_preference DEFAULT 'light'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid; v_total int; v_daily_limit int; v_today_count int;
  v_allowed jsonb; v_require_approval boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_feature_enabled() THEN RAISE EXCEPTION 'Group requests are currently disabled'; END IF;
  IF NOT public.user_has_group_access(v_uid) THEN RAISE EXCEPTION 'Premium plan required to create group requests'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=v_uid AND receive_group_invites=true) THEN
    RAISE EXCEPTION 'Enable "Receive Group Invitations" in Settings first';
  END IF;
  v_total := COALESCE((p_gender_requirements->>'men')::int,0)+COALESCE((p_gender_requirements->>'women')::int,0)+COALESCE((p_gender_requirements->>'any')::int,0);
  IF v_total <> p_member_limit THEN RAISE EXCEPTION 'Gender composition must sum to member limit'; END IF;
  SELECT value INTO v_allowed FROM public.app_settings WHERE key='group_allowed_topics';
  IF v_allowed IS NOT NULL AND NOT (v_allowed ? p_topic) THEN RAISE EXCEPTION 'Topic not allowed'; END IF;
  SELECT COALESCE((value)::text::int,3) INTO v_daily_limit FROM public.app_settings WHERE key='group_daily_create_limit';
  SELECT count(*) INTO v_today_count FROM public.group_requests WHERE creator_id=v_uid AND created_at >= (now() AT TIME ZONE 'UTC')::date;
  IF v_today_count >= v_daily_limit THEN RAISE EXCEPTION 'Daily group request limit reached (%/day)', v_daily_limit; END IF;
  SELECT COALESCE((value)::text::boolean,false) INTO v_require_approval FROM public.app_settings WHERE key='group_require_admin_approval';
  INSERT INTO public.group_requests (creator_id,type,member_limit,gender_requirements,topic,mode,status)
  VALUES (v_uid,p_type,p_member_limit,p_gender_requirements,p_topic,p_mode,
    CASE WHEN v_require_approval THEN 'pending_review'::public.group_request_status ELSE 'open'::public.group_request_status END)
  RETURNING id INTO v_id;
  INSERT INTO public.group_participants (request_id,user_id,join_status,gender_slot)
  VALUES (v_id,v_uid,'approved',(SELECT COALESCE(gender,'any') FROM public.profiles WHERE user_id=v_uid));
  RETURN v_id;
END $$;

-- JOIN
CREATE OR REPLACE FUNCTION public.join_group_request(p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  IF NOT public.user_has_group_access(v_uid) THEN RAISE EXCEPTION 'Premium plan required'; END IF;
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

-- LEAVE
CREATE OR REPLACE FUNCTION public.leave_group_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_req public.group_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_req FROM public.group_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  UPDATE public.group_participants SET join_status='left' WHERE request_id=p_request_id AND user_id=v_uid;
  IF v_req.creator_id=v_uid AND v_req.status='open' THEN
    UPDATE public.group_requests SET status='closed' WHERE id=p_request_id;
  END IF;
END $$;

-- APPROVE
CREATE OR REPLACE FUNCTION public.respond_group_join(p_participant_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_p public.group_participants%ROWTYPE;
  v_req public.group_requests%ROWTYPE; v_total int; v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_p FROM public.group_participants WHERE id=p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;
  SELECT * INTO v_req FROM public.group_requests WHERE id=v_p.request_id FOR UPDATE;
  IF v_req.creator_id<>v_uid AND NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_p.join_status<>'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF p_approve THEN
    UPDATE public.group_participants SET join_status='approved' WHERE id=p_participant_id;
    SELECT count(*) INTO v_total FROM public.group_participants WHERE request_id=v_req.id AND join_status='approved';
    IF v_total >= v_req.member_limit THEN
      INSERT INTO public.chats (mode,is_group,expires_at,timer_stopped)
      VALUES (v_req.mode,true,now()+interval '7 days',true) RETURNING id INTO v_chat_id;
      INSERT INTO public.chat_participants (chat_id,user_id)
      SELECT v_chat_id,gp.user_id FROM public.group_participants gp
      WHERE gp.request_id=v_req.id AND gp.join_status='approved';
      UPDATE public.group_requests SET status='filled',chat_id=v_chat_id WHERE id=v_req.id;
    END IF;
  ELSE
    UPDATE public.group_participants SET join_status='rejected' WHERE id=p_participant_id;
  END IF;
END $$;

-- DISCOVERY
CREATE OR REPLACE FUNCTION public.list_eligible_group_requests()
RETURNS SETOF public.group_requests LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_gender text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT public.group_feature_enabled() THEN RETURN; END IF;
  IF NOT public.user_has_group_access(v_uid) THEN RETURN; END IF;
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
