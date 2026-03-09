ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desktop_notifications_enabled boolean NOT NULL DEFAULT false;