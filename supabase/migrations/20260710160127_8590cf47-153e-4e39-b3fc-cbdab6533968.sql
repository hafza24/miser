
-- Drop duplicate trigger (identical to protect_profile_sensitive_fields) — it doubled the cost of every profile update
DROP TRIGGER IF EXISTS protect_sensitive_fields ON public.profiles;

-- Make the sensitive-fields guard skip work when only presence columns change (heartbeat is by far the hottest update path)
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fast path: presence-only updates never touch protected columns, so skip the admin check entirely
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
     AND NEW.is_suspended IS NOT DISTINCT FROM OLD.is_suspended
     AND NEW.age_verified IS NOT DISTINCT FROM OLD.age_verified
     AND NEW.violation_count IS NOT DISTINCT FROM OLD.violation_count
     AND NEW.dark_mode_blocked IS NOT DISTINCT FROM OLD.dark_mode_blocked
     AND NEW.light_mode_blocked IS NOT DISTINCT FROM OLD.light_mode_blocked
     AND NEW.daily_chat_limit IS NOT DISTINCT FROM OLD.daily_chat_limit
     AND NEW.daily_scene_limit IS NOT DISTINCT FROM OLD.daily_scene_limit
     AND NEW.scheduled_deletion_at IS NOT DISTINCT FROM OLD.scheduled_deletion_at
     AND NEW.muted_until IS NOT DISTINCT FROM OLD.muted_until THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.payment_status := OLD.payment_status;
  NEW.is_suspended := OLD.is_suspended;
  NEW.age_verified := OLD.age_verified;
  NEW.violation_count := OLD.violation_count;
  NEW.dark_mode_blocked := OLD.dark_mode_blocked;
  NEW.light_mode_blocked := OLD.light_mode_blocked;
  NEW.daily_chat_limit := OLD.daily_chat_limit;
  NEW.daily_scene_limit := OLD.daily_scene_limit;
  NEW.scheduled_deletion_at := OLD.scheduled_deletion_at;
  NEW.muted_until := OLD.muted_until;
  RETURN NEW;
END;
$function$;

-- Lightweight presence RPC so the client can update only the two columns and skip PostgREST overhead
CREATE OR REPLACE FUNCTION public.update_presence(_is_online boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.profiles
     SET is_online = _is_online,
         last_seen_at = now()
   WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.update_presence(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_presence(boolean) TO authenticated;

-- Missing indexes on hot query paths
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_receiver_status_created ON public.chat_requests (receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mention_notifications_message ON public.mention_notifications (message_id);
