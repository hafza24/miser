
-- =========================================================
-- chat_invites: split inviter (cancel-only) vs invitee (respond)
-- =========================================================
DROP POLICY IF EXISTS "Invitee can update own invites" ON public.chat_invites;

CREATE POLICY "Inviter can cancel own invite"
  ON public.chat_invites
  FOR UPDATE
  TO authenticated
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "Invitee can respond to invite"
  ON public.chat_invites
  FOR UPDATE
  TO authenticated
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() AND status IN ('accepted','declined'));

CREATE OR REPLACE FUNCTION public.enforce_chat_invite_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS DISTINCT FROM OLD.chat_id
     OR NEW.inviter_id IS DISTINCT FROM OLD.inviter_id
     OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'chat_invites: chat_id/inviter_id/invitee_id/created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_invites_immutable ON public.chat_invites;
CREATE TRIGGER chat_invites_immutable
  BEFORE UPDATE ON public.chat_invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_invite_immutable();

-- =========================================================
-- chat_requests: receiver can only respond, cannot rewrite fields
-- =========================================================
DROP POLICY IF EXISTS "Receiver can respond to requests" ON public.chat_requests;

CREATE POLICY "Receiver can respond to requests"
  ON public.chat_requests
  FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid() AND status IN ('accepted','declined'));

CREATE OR REPLACE FUNCTION public.enforce_chat_request_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'chat_requests: sender_id/receiver_id/message/created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_requests_immutable ON public.chat_requests;
CREATE TRIGGER chat_requests_immutable
  BEFORE UPDATE ON public.chat_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_request_immutable();

-- =========================================================
-- chats: participants can update, but only mutable timer/meta fields
-- =========================================================
DROP POLICY IF EXISTS "Participants can update chat timer" ON public.chats;

CREATE POLICY "Participants can update chat"
  ON public.chats
  FOR UPDATE
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), id))
  WITH CHECK (public.is_chat_participant(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.enforce_chat_update_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always-immutable columns
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.is_group IS DISTINCT FROM OLD.is_group
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'chats: mode/is_group/created_by/created_at are immutable';
  END IF;

  -- Name / image / member_limit: only creator (or admin) may change
  IF (NEW.name IS DISTINCT FROM OLD.name
      OR NEW.image_url IS DISTINCT FROM OLD.image_url
      OR NEW.member_limit IS DISTINCT FROM OLD.member_limit)
     AND auth.uid() IS NOT NULL
     AND auth.uid() <> OLD.created_by
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'chats: only the creator can change name/image_url/member_limit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chats_update_scope ON public.chats;
CREATE TRIGGER chats_update_scope
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_update_scope();

-- =========================================================
-- timer_stop_requests: responder may only flip status
-- =========================================================
DROP POLICY IF EXISTS "Users can respond to timer stop requests" ON public.timer_stop_requests;

CREATE POLICY "Users can respond to timer stop requests"
  ON public.timer_stop_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), chat_id) AND sender_id <> auth.uid())
  WITH CHECK (
    public.is_chat_participant(auth.uid(), chat_id)
    AND sender_id <> auth.uid()
    AND status IN ('accepted','declined','pending')
  );

CREATE OR REPLACE FUNCTION public.enforce_timer_stop_request_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS DISTINCT FROM OLD.chat_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'timer_stop_requests: chat_id/sender_id/created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timer_stop_requests_immutable ON public.timer_stop_requests;
CREATE TRIGGER timer_stop_requests_immutable
  BEFORE UPDATE ON public.timer_stop_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_timer_stop_request_immutable();

-- =========================================================
-- mode_switch_requests: responder may only flip status
-- =========================================================
DROP POLICY IF EXISTS "Users can respond to mode switch requests" ON public.mode_switch_requests;

CREATE POLICY "Users can respond to mode switch requests"
  ON public.mode_switch_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_chat_participant(auth.uid(), chat_id) AND sender_id <> auth.uid())
  WITH CHECK (
    public.is_chat_participant(auth.uid(), chat_id)
    AND sender_id <> auth.uid()
    AND status IN ('accepted','declined','pending')
  );

CREATE OR REPLACE FUNCTION public.enforce_mode_switch_request_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS DISTINCT FROM OLD.chat_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.target_mode IS DISTINCT FROM OLD.target_mode
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'mode_switch_requests: chat_id/sender_id/target_mode/created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mode_switch_requests_immutable ON public.mode_switch_requests;
CREATE TRIGGER mode_switch_requests_immutable
  BEFORE UPDATE ON public.mode_switch_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mode_switch_request_immutable();
