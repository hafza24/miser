
CREATE POLICY "chat-media participants can upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'chat-media'
    AND public.is_chat_participant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "chat-media participants can read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'chat-media'
    AND public.is_chat_participant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "chat-media service role can delete" ON storage.objects
  FOR DELETE TO service_role USING (bucket_id = 'chat-media');
