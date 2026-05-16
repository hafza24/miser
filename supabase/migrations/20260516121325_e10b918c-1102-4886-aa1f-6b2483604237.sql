
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS muted_until timestamptz;

-- Update sensitive-field guard to also lock muted_until
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;

-- message_reports table
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  chat_id uuid,
  message_id uuid,
  message_content text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their own reports" ON public.message_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users view their own reports" ON public.message_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

CREATE POLICY "Admins view all reports" ON public.message_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update reports" ON public.message_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Escalation function
CREATE OR REPLACE FUNCTION public.process_violation(_content text, _mode text DEFAULT 'light')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_type violation_type;
  v_mute_until timestamptz;
  v_suspend boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT count(*) INTO v_count FROM public.moderation_logs WHERE user_id = v_uid;
  v_count := v_count + 1;

  IF v_count >= 5 THEN
    v_type := 'suspension'; v_suspend := true;
  ELSIF v_count = 4 THEN
    v_type := 'mute'; v_mute_until := now() + interval '1 hour';
  ELSIF v_count = 3 THEN
    v_type := 'mute'; v_mute_until := now() + interval '10 minutes';
  ELSE
    v_type := 'warning';
  END IF;

  INSERT INTO public.moderation_logs (user_id, violation_type, message_text)
  VALUES (v_uid, v_type, left(coalesce(_content, ''), 500));

  UPDATE public.profiles
  SET violation_count = v_count,
      muted_until = COALESCE(v_mute_until, muted_until),
      is_suspended = CASE WHEN v_suspend THEN true ELSE is_suspended END
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'strike', v_count,
    'type', v_type,
    'muted_until', v_mute_until,
    'suspended', v_suspend
  );
END;
$$;

-- Reporting function
CREATE OR REPLACE FUNCTION public.report_message(
  _reported_user_id uuid,
  _chat_id uuid,
  _message_id uuid,
  _message_content text,
  _reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(coalesce(_reason,'')) < 5 THEN RAISE EXCEPTION 'Reason too short'; END IF;

  INSERT INTO public.message_reports
    (reporter_id, reported_user_id, chat_id, message_id, message_content, reason)
  VALUES
    (v_uid, _reported_user_id, _chat_id, _message_id, left(coalesce(_message_content,''),1000), left(_reason, 1000))
  RETURNING id INTO v_id;

  -- count toward reported user's violation tally
  UPDATE public.profiles
  SET violation_count = violation_count + 1,
      is_suspended = CASE WHEN violation_count + 1 >= 5 THEN true ELSE is_suspended END
  WHERE user_id = _reported_user_id;

  RETURN v_id;
END;
$$;
