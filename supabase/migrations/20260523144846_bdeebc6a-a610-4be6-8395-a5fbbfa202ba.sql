
-- Profile language prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS secondary_language text,
  ADD COLUMN IF NOT EXISTS auto_translate_enabled boolean NOT NULL DEFAULT true;

-- Translations cache
CREATE TABLE IF NOT EXISTS public.message_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  target_language text NOT NULL,
  translated_text text NOT NULL,
  detected_language text,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, target_language)
);

CREATE INDEX IF NOT EXISTS idx_message_translations_message ON public.message_translations(message_id);

ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view translations"
  ON public.message_translations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_translations.message_id
      AND public.is_chat_participant(auth.uid(), m.chat_id)
  ));

CREATE POLICY "Participants can insert translations"
  ON public.message_translations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_translations.message_id
      AND public.is_chat_participant(auth.uid(), m.chat_id)
  ));

-- App settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.app_settings FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('translation_enabled', 'true'::jsonb),
  ('translation_model', '"google/gemini-3-flash-preview"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Update protect trigger to allow language fields (they are not sensitive, but trigger preserves only listed fields, so no change needed)
