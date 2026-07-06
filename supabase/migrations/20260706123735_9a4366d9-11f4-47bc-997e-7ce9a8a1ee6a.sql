
-- 1) Table
CREATE TABLE IF NOT EXISTS public.mention_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  mentioner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS mention_notifications_user_created_idx
  ON public.mention_notifications (user_id, created_at DESC);

-- 2) Grants
GRANT SELECT, UPDATE, DELETE ON public.mention_notifications TO authenticated;
GRANT ALL ON public.mention_notifications TO service_role;

-- 3) RLS
ALTER TABLE public.mention_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view their own mentions"
  ON public.mention_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Recipients can update their own mentions"
  ON public.mention_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Recipients can delete their own mentions"
  ON public.mention_notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mention_notifications;
ALTER TABLE public.mention_notifications REPLICA IDENTITY FULL;

-- 5) Fan-out function + trigger
CREATE OR REPLACE FUNCTION public.fanout_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aliases text[];
BEGIN
  IF NEW.content IS NULL OR length(NEW.content) = 0 THEN
    RETURN NEW;
  END IF;

  -- Extract distinct @alias tokens (letters, digits, underscore), case-insensitive
  SELECT COALESCE(array_agg(DISTINCT lower(m[1])), ARRAY[]::text[])
  INTO aliases
  FROM regexp_matches(NEW.content, '@([A-Za-z0-9_]{2,64})', 'g') AS m;

  IF array_length(aliases, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mention_notifications (user_id, message_id, chat_id, mentioner_id)
  SELECT p.user_id, NEW.id, NEW.chat_id, NEW.sender_id
  FROM public.profiles p
  JOIN public.chat_participants cp
    ON cp.user_id = p.user_id
   AND cp.chat_id = NEW.chat_id
   AND cp.removed_at IS NULL
  WHERE lower(p.alias) = ANY(aliases)
    AND p.user_id <> NEW.sender_id
    AND p.notify_mentions = true
    AND p.is_suspended = false
    AND NOT public.is_blocked(p.user_id, NEW.sender_id)
  ON CONFLICT (user_id, message_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_mention_notifications ON public.messages;
CREATE TRIGGER trg_fanout_mention_notifications
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fanout_mention_notifications();
