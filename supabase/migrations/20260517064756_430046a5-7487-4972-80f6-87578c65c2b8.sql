
-- 1) Fix chat_participants INSERT policy: require chat matches the pending request
DROP POLICY IF EXISTS "Users can join via request or self-add" ON public.chat_participants;

CREATE POLICY "Users can join via request or self-add"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.chat_requests cr
    WHERE cr.status = 'accepted'
      AND cr.receiver_id = auth.uid()
      AND cr.sender_id = chat_participants.user_id
      AND EXISTS (
        SELECT 1 FROM public.chat_participants cp2
        WHERE cp2.chat_id = chat_participants.chat_id
          AND cp2.user_id = auth.uid()
      )
  )
);

-- 2) Harden report_message: require chat membership; prevent duplicate reports of same message
ALTER TABLE public.message_reports
  ADD COLUMN IF NOT EXISTS unique_key text;

CREATE UNIQUE INDEX IF NOT EXISTS message_reports_unique_reporter_message
  ON public.message_reports (reporter_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.report_message(
  _reported_user_id uuid,
  _chat_id uuid,
  _message_id uuid,
  _message_content text,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(coalesce(_reason,'')) < 5 THEN RAISE EXCEPTION 'Reason too short'; END IF;
  IF _chat_id IS NULL OR NOT public.is_chat_participant(v_uid, _chat_id) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;
  IF _reported_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot report yourself';
  END IF;
  IF _message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _message_id
      AND m.chat_id = _chat_id
      AND m.sender_id = _reported_user_id
  ) THEN
    RAISE EXCEPTION 'Message does not belong to reported user in this chat';
  END IF;

  INSERT INTO public.message_reports
    (reporter_id, reported_user_id, chat_id, message_id, message_content, reason)
  VALUES
    (v_uid, _reported_user_id, _chat_id, _message_id, left(coalesce(_message_content,''),1000), left(_reason, 1000))
  RETURNING id INTO v_id;

  -- No automatic suspension here. Admins review reports in dashboard.
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'You have already reported this message';
END;
$function$;

-- 3) Server-side moderation trigger on messages
CREATE OR REPLACE FUNCTION public.enforce_message_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lower text := lower(coalesce(NEW.content,''));
  v_mode text;
  v_muted timestamptz;
  illegal text[] := ARRAY['kill you','murder','suicide','rape','molest','trafficking','underage','child porn',' cp ','terrorism','bomb threat','pedo','loli'];
  abuse text[] := ARRAY['retard','faggot','nigger','kike','chink','spic','kys','kill yourself','go die'];
  nsfw text[] := ARRAY['sex','nude','porn','explicit','naked','xxx','fetish','orgasm','erotic','nsfw','dick','pussy','cock','tits','boobs','cum','masturbate','jerk off'];
  k text;
BEGIN
  -- Mute check
  SELECT muted_until INTO v_muted FROM public.profiles WHERE user_id = NEW.sender_id;
  IF v_muted IS NOT NULL AND v_muted > now() THEN
    RAISE EXCEPTION 'You are temporarily muted until %', v_muted;
  END IF;

  FOREACH k IN ARRAY illegal LOOP
    IF position(k in v_lower) > 0 THEN
      PERFORM public.process_violation(NEW.content, 'illegal');
      RAISE EXCEPTION 'Message contains prohibited content';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY abuse LOOP
    IF position(k in v_lower) > 0 THEN
      PERFORM public.process_violation(NEW.content, 'abuse');
      RAISE EXCEPTION 'Abusive language is not allowed';
    END IF;
  END LOOP;

  SELECT c.mode::text INTO v_mode FROM public.chats c WHERE c.id = NEW.chat_id;
  IF v_mode = 'light' THEN
    FOREACH k IN ARRAY nsfw LOOP
      IF position(k in v_lower) > 0 THEN
        PERFORM public.process_violation(NEW.content, 'nsfw');
        RAISE EXCEPTION 'Explicit content is not allowed in Light Mode';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_message_moderation ON public.messages;
CREATE TRIGGER trg_enforce_message_moderation
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_moderation();

-- 4) Storage DELETE policies for payment-screenshots bucket
CREATE POLICY "Users can delete own payment screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can delete any payment screenshot"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update payment screenshots"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND public.has_role(auth.uid(), 'admin')
);

-- 5) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_tickets;

-- 6) Lock down SECURITY DEFINER helper functions from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_plan_limits(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_daily_chat_limit(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_random_user(mode_preference) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_user_report(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_alias() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_emoji_avatar() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_ids(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles() FROM anon;

-- Keep these callable by authenticated (they are user-facing RPCs)
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_random_chat(mode_preference) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chat_request(uuid, mode_preference) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_message(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_violation(text, text) TO authenticated;
