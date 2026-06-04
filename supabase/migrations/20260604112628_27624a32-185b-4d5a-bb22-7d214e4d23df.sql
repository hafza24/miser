
-- ============ chats / participants / messages additions ============
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS member_limit int NOT NULL DEFAULT 10;

ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_participants_role_check') THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_role_check CHECK (role IN ('owner','admin','member'));
  END IF;
END $$;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_size int,
  ADD COLUMN IF NOT EXISTS view_once boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_by uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_for_all boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_media_type_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_media_type_check CHECK (media_type IS NULL OR media_type IN ('image','video','audio','file'));
  END IF;
END $$;

-- Allow content empty for media-only messages
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- Hide deleted-for-all media from non-senders by updating SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_chat_participant(auth.uid(), chat_id)
    AND (deleted_for_all = false OR sender_id = auth.uid())
  );

-- ============ chat_invites ============
CREATE TABLE IF NOT EXISTS public.chat_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_invites_unique_pending
  ON public.chat_invites(chat_id, invitee_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.chat_invites TO authenticated;
GRANT ALL ON public.chat_invites TO service_role;
ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invitee can view own invites" ON public.chat_invites
  FOR SELECT TO authenticated USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Invitee can update own invites" ON public.chat_invites
  FOR UPDATE TO authenticated USING (invitee_id = auth.uid() OR inviter_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() OR inviter_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_invites;

-- ============ media_views ============
CREATE TABLE IF NOT EXISTS public.media_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, viewer_id)
);

GRANT SELECT, INSERT ON public.media_views TO authenticated;
GRANT ALL ON public.media_views TO service_role;
ALTER TABLE public.media_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view media_views" ON public.media_views
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_chat_participant(auth.uid(), m.chat_id))
  );
CREATE POLICY "Self can insert own media_views" ON public.media_views
  FOR INSERT TO authenticated WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_chat_participant(auth.uid(), m.chat_id))
  );

-- ============ helper: chat role ============
CREATE OR REPLACE FUNCTION public.chat_role(_user_id uuid, _chat_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.chat_participants
   WHERE user_id = _user_id AND chat_id = _chat_id AND removed_at IS NULL
   LIMIT 1
$$;

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.upgrade_chat_to_group(p_chat_id uuid, p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_chat_participant(v_uid, p_chat_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  UPDATE public.chats
    SET is_group = true,
        name = COALESCE(NULLIF(trim(p_name),''), 'Group chat'),
        created_by = COALESCE(created_by, v_uid),
        timer_stopped = true,
        expires_at = NULL
    WHERE id = p_chat_id;
  UPDATE public.chat_participants SET role = 'owner' WHERE chat_id = p_chat_id AND user_id = v_uid;
  UPDATE public.chat_participants SET role = COALESCE(role,'member') WHERE chat_id = p_chat_id AND user_id <> v_uid AND role IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.invite_to_chat(p_chat_id uuid, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_count int; v_limit int; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_role := public.chat_role(v_uid, p_chat_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Only owners or admins can invite'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'Cannot invite yourself'; END IF;
  IF public.is_blocked(v_uid, p_user_id) THEN RAISE EXCEPTION 'Cannot invite blocked user'; END IF;
  IF public.is_restricted(p_user_id, v_uid) THEN RAISE EXCEPTION 'User has restricted you'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id AND removed_at IS NULL) THEN
    RAISE EXCEPTION 'User already in chat';
  END IF;
  SELECT count(*) INTO v_count FROM public.chat_participants WHERE chat_id = p_chat_id AND removed_at IS NULL;
  SELECT member_limit INTO v_limit FROM public.chats WHERE id = p_chat_id;
  IF v_count >= v_limit THEN RAISE EXCEPTION 'Member limit reached'; END IF;
  INSERT INTO public.chat_invites (chat_id, inviter_id, invitee_id)
  VALUES (p_chat_id, v_uid, p_user_id)
  ON CONFLICT (chat_id, invitee_id) WHERE status = 'pending' DO UPDATE SET created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_chat_invite(p_invite_id uuid, p_accept boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_inv public.chat_invites%ROWTYPE; v_count int; v_limit int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.chat_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR v_inv.invitee_id <> v_uid THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invite already handled'; END IF;
  IF p_accept THEN
    SELECT count(*) INTO v_count FROM public.chat_participants WHERE chat_id = v_inv.chat_id AND removed_at IS NULL;
    SELECT member_limit INTO v_limit FROM public.chats WHERE id = v_inv.chat_id;
    IF v_count >= v_limit THEN RAISE EXCEPTION 'Chat is full'; END IF;
    INSERT INTO public.chat_participants (chat_id, user_id, role)
    VALUES (v_inv.chat_id, v_uid, 'member')
    ON CONFLICT (chat_id, user_id) DO UPDATE SET removed_at = NULL, role = 'member';
    UPDATE public.chat_invites SET status = 'accepted', responded_at = now() WHERE id = p_invite_id;
    RETURN v_inv.chat_id;
  ELSE
    UPDATE public.chat_invites SET status = 'declined', responded_at = now() WHERE id = p_invite_id;
    RETURN NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_target_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_role := public.chat_role(v_uid, p_chat_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  v_target_role := public.chat_role(p_user_id, p_chat_id);
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Cannot remove the owner'; END IF;
  UPDATE public.chat_participants SET removed_at = now()
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.leave_chat(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_next uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_role := public.chat_role(v_uid, p_chat_id);
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  UPDATE public.chat_participants SET removed_at = now() WHERE chat_id = p_chat_id AND user_id = v_uid;
  IF v_role = 'owner' THEN
    SELECT user_id INTO v_next FROM public.chat_participants
      WHERE chat_id = p_chat_id AND removed_at IS NULL AND user_id <> v_uid
      ORDER BY (role = 'admin') DESC, joined_at ASC LIMIT 1;
    IF v_next IS NOT NULL THEN
      UPDATE public.chat_participants SET role = 'owner' WHERE chat_id = p_chat_id AND user_id = v_next;
    ELSE
      UPDATE public.chats SET timer_stopped = true, expires_at = now() WHERE id = p_chat_id;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_group_meta(p_chat_id uuid, p_name text, p_image_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  v_role := public.chat_role(auth.uid(), p_chat_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.chats
    SET name = COALESCE(NULLIF(trim(p_name),''), name),
        image_url = COALESCE(p_image_url, image_url)
    WHERE id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_media_viewed(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_msg public.messages%ROWTYPE; v_participants int; v_viewed int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.is_chat_participant(v_uid, v_msg.chat_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_msg.sender_id = v_uid THEN RETURN; END IF;
  INSERT INTO public.media_views (message_id, viewer_id) VALUES (p_message_id, v_uid)
    ON CONFLICT DO NOTHING;
  UPDATE public.messages
    SET viewed_by = (SELECT array_agg(DISTINCT x) FROM unnest(viewed_by || ARRAY[v_uid]) x)
    WHERE id = p_message_id;
  IF v_msg.view_once THEN
    SELECT count(*) INTO v_participants FROM public.chat_participants
      WHERE chat_id = v_msg.chat_id AND removed_at IS NULL AND user_id <> v_msg.sender_id;
    SELECT count(*) INTO v_viewed FROM public.media_views WHERE message_id = p_message_id;
    IF v_viewed >= v_participants THEN
      UPDATE public.messages SET deleted_for_all = true WHERE id = p_message_id;
    END IF;
  END IF;
END $$;
