
-- 1) Table
CREATE TABLE IF NOT EXISTS public.match_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  matched_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, matched_user_id)
);

CREATE INDEX IF NOT EXISTS match_notifications_user_created_idx
  ON public.match_notifications (user_id, created_at DESC);

-- 2) Grants
GRANT SELECT, UPDATE, DELETE ON public.match_notifications TO authenticated;
GRANT ALL ON public.match_notifications TO service_role;

-- 3) RLS
ALTER TABLE public.match_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view their own match notifications"
  ON public.match_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Recipients can update their own match notifications"
  ON public.match_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Recipients can delete their own match notifications"
  ON public.match_notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_notifications;
ALTER TABLE public.match_notifications REPLICA IDENTITY FULL;

-- 5) Fan-out function + trigger
CREATE OR REPLACE FUNCTION public.fanout_match_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  became_discoverable boolean := false;
  interests_changed boolean := false;
BEGIN
  -- Only consider profiles that are currently discoverable and not suspended
  IF NEW.is_suspended = true
     OR NEW.profile_paused = true
     OR NEW.hidden_from_discovery = true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    became_discoverable := true;
  ELSE
    became_discoverable :=
      (COALESCE(OLD.is_suspended, false) = true      AND NEW.is_suspended = false)
      OR (COALESCE(OLD.profile_paused, false) = true AND NEW.profile_paused = false)
      OR (COALESCE(OLD.hidden_from_discovery, false) = true AND NEW.hidden_from_discovery = false)
      OR (COALESCE(OLD.mode_preference::text,'') <> COALESCE(NEW.mode_preference::text,''));
    interests_changed := COALESCE(OLD.interests, ARRAY[]::text[]) <> COALESCE(NEW.interests, ARRAY[]::text[]);
  END IF;

  IF NOT (became_discoverable OR interests_changed) THEN
    RETURN NEW;
  END IF;

  -- Insert one notification per compatible recipient (dedup by unique constraint)
  INSERT INTO public.match_notifications (user_id, matched_user_id)
  SELECT r.user_id, NEW.user_id
  FROM public.profiles r
  WHERE r.user_id <> NEW.user_id
    AND r.notify_matches = true
    AND r.is_suspended = false
    AND COALESCE(r.mode_preference::text, '') = COALESCE(NEW.mode_preference::text, '')
    AND (
      COALESCE(array_length(r.interests, 1), 0) = 0
      OR COALESCE(array_length(NEW.interests, 1), 0) = 0
      OR r.interests && NEW.interests
    )
    AND (r.age_min IS NULL OR NEW.age IS NULL OR NEW.age >= r.age_min)
    AND (r.age_max IS NULL OR NEW.age IS NULL OR NEW.age <= r.age_max)
    AND NOT public.is_blocked(r.user_id, NEW.user_id)
    AND NOT public.is_restricted(NEW.user_id, r.user_id)
  ON CONFLICT (user_id, matched_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_match_notifications ON public.profiles;
CREATE TRIGGER trg_fanout_match_notifications
  AFTER INSERT OR UPDATE OF is_suspended, profile_paused, hidden_from_discovery,
                             mode_preference, interests, age
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fanout_match_notifications();
