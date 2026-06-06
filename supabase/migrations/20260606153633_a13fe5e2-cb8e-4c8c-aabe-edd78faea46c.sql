
-- 1. Restrict app_settings SELECT to authenticated only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- 2. Add strict INSERT policy on chat_invites (RPC uses SECURITY DEFINER and bypasses, but defense in depth)
CREATE POLICY "Inviter must be chat participant"
  ON public.chat_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND public.is_chat_participant(auth.uid(), chat_id)
  );

-- 3. Tighten realtime fallback so non-UUID topics are denied
DROP POLICY IF EXISTS "Participants can receive realtime for their chats" ON realtime.messages;
CREATE POLICY "Participants can receive realtime for their chats"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_chat_participant(auth.uid(), (realtime.topic())::uuid)
      ELSE false
    END
  );
