
-- Table to track blocked users
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can block others
CREATE POLICY "Users can block others"
  ON public.blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

-- Users can view their own blocks
CREATE POLICY "Users can view own blocks"
  ON public.blocked_users FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

-- Users can unblock
CREATE POLICY "Users can unblock"
  ON public.blocked_users FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- Admins can view all blocks
CREATE POLICY "Admins can view all blocks"
  ON public.blocked_users FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Security definer function to check if blocked (either direction)
CREATE OR REPLACE FUNCTION public.is_blocked(_user1 uuid, _user2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = _user1 AND blocked_id = _user2)
       OR (blocker_id = _user2 AND blocked_id = _user1)
  )
$$;

-- Update find_random_user to exclude blocked users
CREATE OR REPLACE FUNCTION public.find_random_user(p_mode mode_preference)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT p.user_id INTO v_user_id
  FROM profiles p
  WHERE p.user_id <> auth.uid()
    AND p.mode_preference = p_mode
    AND p.is_suspended = false
    AND NOT public.is_blocked(auth.uid(), p.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM chat_requests cr
      WHERE ((cr.sender_id = auth.uid() AND cr.receiver_id = p.user_id)
         OR (cr.sender_id = p.user_id AND cr.receiver_id = auth.uid()))
        AND cr.status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_participants cp1
      JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
      JOIN chats c ON c.id = cp1.chat_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = p.user_id
        AND (c.timer_stopped = true OR c.expires_at > now())
    )
  ORDER BY random()
  LIMIT 1;
  
  RETURN v_user_id;
END;
$function$;
