
-- 1) Prevent self role escalation on chat_participants
CREATE OR REPLACE FUNCTION public.prevent_chat_participant_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- If the row belongs to the caller, they may not change their own role
  IF NEW.user_id = auth.uid() AND COALESCE(NEW.role,'') IS DISTINCT FROM COALESCE(OLD.role,'') THEN
    RAISE EXCEPTION 'You cannot change your own role in a chat';
  END IF;
  -- If the row belongs to someone else, only chat owners/admins may change role
  IF NEW.user_id <> auth.uid() AND COALESCE(NEW.role,'') IS DISTINCT FROM COALESCE(OLD.role,'') THEN
    IF public.chat_role(auth.uid(), NEW.chat_id) NOT IN ('owner','admin') THEN
      RAISE EXCEPTION 'Only chat owners or admins can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_chat_participant_self_escalation ON public.chat_participants;
CREATE TRIGGER trg_prevent_chat_participant_self_escalation
BEFORE UPDATE ON public.chat_participants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_chat_participant_self_escalation();

-- 2) Prevent self-blocking in blocked_users
ALTER TABLE public.blocked_users
  DROP CONSTRAINT IF EXISTS blocked_users_no_self_block;
ALTER TABLE public.blocked_users
  ADD CONSTRAINT blocked_users_no_self_block CHECK (blocker_id <> blocked_id);

-- 3) Consolidate duplicate SELECT policies on chat_participants
DROP POLICY IF EXISTS "Users can view co-participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view their participations" ON public.chat_participants;

CREATE POLICY "Participants can view chat membership"
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_chat_participant(auth.uid(), chat_id)
);
