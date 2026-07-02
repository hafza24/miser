
-- Mood Rooms table
CREATE TABLE public.mood_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mood_key text NOT NULL,
  name text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '✨',
  mode public.mode_preference NOT NULL DEFAULT 'light',
  chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
  chat_expires_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mood_key, mode)
);

GRANT SELECT ON public.mood_rooms TO authenticated;
GRANT ALL ON public.mood_rooms TO service_role;

ALTER TABLE public.mood_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active mood rooms"
  ON public.mood_rooms FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage mood rooms"
  ON public.mood_rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Join / rotate function
CREATE OR REPLACE FUNCTION public.join_mood_room(p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.mood_rooms%ROWTYPE;
  v_end_of_day timestamptz;
  v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_room FROM public.mood_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR NOT v_room.is_active THEN RAISE EXCEPTION 'Room not available'; END IF;

  IF v_room.mode = 'dark' AND NOT public.user_has_dark_access(v_uid) THEN
    RAISE EXCEPTION 'Dark Mode required for this room';
  END IF;

  -- End of today UTC
  v_end_of_day := date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day';

  -- Rotate: if no chat, or existing chat expired, spin up a new one
  IF v_room.chat_id IS NULL OR v_room.chat_expires_at IS NULL OR v_room.chat_expires_at <= now() THEN
    INSERT INTO public.chats (mode, is_group, expires_at, timer_stopped, name, created_by, member_limit)
    VALUES (v_room.mode, true, v_end_of_day, false, v_room.emoji || ' ' || v_room.name, v_uid, 100)
    RETURNING id INTO v_chat_id;

    UPDATE public.mood_rooms
    SET chat_id = v_chat_id, chat_expires_at = v_end_of_day
    WHERE id = p_room_id;
  ELSE
    v_chat_id := v_room.chat_id;
  END IF;

  -- Add participant (idempotent)
  INSERT INTO public.chat_participants (chat_id, user_id, role)
  VALUES (v_chat_id, v_uid, 'member')
  ON CONFLICT (chat_id, user_id)
  DO UPDATE SET removed_at = NULL;

  RETURN v_chat_id;
END;
$$;

-- Live participant count listing
CREATE OR REPLACE FUNCTION public.list_mood_rooms()
RETURNS TABLE (
  id uuid, mood_key text, name text, description text, emoji text,
  mode public.mode_preference, sort_order int,
  chat_id uuid, chat_expires_at timestamptz,
  participant_count bigint, joined boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.mood_key, r.name, r.description, r.emoji, r.mode, r.sort_order,
    r.chat_id, r.chat_expires_at,
    COALESCE((
      SELECT count(*) FROM public.chat_participants cp
      WHERE cp.chat_id = r.chat_id AND cp.removed_at IS NULL
        AND r.chat_expires_at > now()
    ), 0) AS participant_count,
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = r.chat_id AND cp.user_id = auth.uid() AND cp.removed_at IS NULL
        AND r.chat_expires_at > now()
    ) AS joined
  FROM public.mood_rooms r
  WHERE r.is_active = true
  ORDER BY r.mode, r.sort_order;
$$;
