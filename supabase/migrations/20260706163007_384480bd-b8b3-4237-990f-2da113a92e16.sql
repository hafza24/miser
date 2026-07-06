
DROP POLICY IF EXISTS "chat-media participants can read" ON storage.objects;

CREATE POLICY "chat-media participants can read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'chat-media'
    AND public.is_chat_participant(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.media_path = storage.objects.name
        AND m.view_once = true
        AND m.media_type = 'image'
        AND (
          m.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.media_views mv
            WHERE mv.message_id = m.id AND mv.viewer_id = auth.uid()
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.mark_media_viewed(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
  v_participants int;
  v_viewed int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.is_chat_participant(v_uid, v_msg.chat_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_msg.sender_id = v_uid THEN RETURN; END IF;

  INSERT INTO public.media_views (message_id, viewer_id) VALUES (p_message_id, v_uid)
    ON CONFLICT DO NOTHING;
  UPDATE public.messages
    SET viewed_by = (SELECT array_agg(DISTINCT x) FROM unnest(viewed_by || ARRAY[v_uid]) x)
    WHERE id = p_message_id;

  IF v_msg.view_once THEN
    SELECT count(*) INTO v_participants FROM public.chat_participants
      WHERE chat_id = v_msg.chat_id AND removed_at IS NULL AND user_id <> v_msg.sender_id;
    SELECT count(*) INTO v_viewed FROM public.media_views WHERE message_id = p_message_id;
    IF v_viewed >= v_participants THEN
      IF v_msg.media_path IS NOT NULL THEN
        DELETE FROM storage.objects
          WHERE bucket_id = 'chat-media' AND name = v_msg.media_path;
      END IF;
      UPDATE public.messages
        SET deleted_for_all = true, media_path = NULL
        WHERE id = p_message_id;
    END IF;
  END IF;
END $$;
