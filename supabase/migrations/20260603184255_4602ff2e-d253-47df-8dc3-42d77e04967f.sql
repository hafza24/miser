
-- M1: Profile + Matching + Notification preferences

-- 1. Presence status (online / away / busy / invisible)
DO $$ BEGIN
  CREATE TYPE public.presence_status AS ENUM ('online','away','busy','invisible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_status public.presence_status NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS profile_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_from_discovery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS looking_for text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS gender_preference text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS location_preference text NOT NULL DEFAULT 'worldwide',
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS age_min int,
  ADD COLUMN IF NOT EXISTS age_max int,
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS preferred_languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_matches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_group_invites_pref boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_expiry boolean NOT NULL DEFAULT true;

-- Sanity constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_preference_check
  CHECK (gender_preference IN ('male','female','any'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_location_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_location_preference_check
  CHECK (location_preference IN ('near_me','same_city','same_country','worldwide'));

-- Indexes for matching
CREATE INDEX IF NOT EXISTS idx_profiles_discovery
  ON public.profiles (hidden_from_discovery, profile_paused, is_suspended);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles (gender);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles (country);
CREATE INDEX IF NOT EXISTS idx_profiles_presence ON public.profiles (presence_status);

-- 3. Mute & Restrict tables (block already exists)
CREATE TABLE IF NOT EXISTS public.muted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.muted_users TO authenticated;
GRANT ALL ON public.muted_users TO service_role;
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own mutes" ON public.muted_users
  FOR ALL TO authenticated
  USING (auth.uid() = muter_id) WITH CHECK (auth.uid() = muter_id);

CREATE TABLE IF NOT EXISTS public.restricted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restrictor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restrictor_id, restricted_id),
  CHECK (restrictor_id <> restricted_id)
);
GRANT SELECT, INSERT, DELETE ON public.restricted_users TO authenticated;
GRANT ALL ON public.restricted_users TO service_role;
ALTER TABLE public.restricted_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own restrictions" ON public.restricted_users
  FOR ALL TO authenticated
  USING (auth.uid() = restrictor_id) WITH CHECK (auth.uid() = restrictor_id);

CREATE INDEX IF NOT EXISTS idx_muted_users_muter ON public.muted_users (muter_id);
CREATE INDEX IF NOT EXISTS idx_restricted_users_restrictor ON public.restricted_users (restrictor_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_muted(_muter uuid, _other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.muted_users WHERE muter_id = _muter AND muted_id = _other)
$$;

CREATE OR REPLACE FUNCTION public.is_restricted(_restrictor uuid, _other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restricted_users WHERE restrictor_id = _restrictor AND restricted_id = _other)
$$;

-- 4. Update get_public_profiles: hide paused/hidden, return new fields, and treat invisible as offline
DROP FUNCTION IF EXISTS public.get_public_profiles();
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (
  user_id uuid, alias text, emoji_avatar text, bio text, interests text[],
  mood_preference text, region text, availability text,
  character_title text, character_description text, character_personality text[], character_life_story text,
  is_online boolean, last_seen_at timestamptz, gender text, mode_preference mode_preference,
  presence_status public.presence_status, looking_for text[], gender_preference text,
  location_preference text, country text, city text, age int,
  preferred_languages text[], primary_language text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.user_id, p.alias, p.emoji_avatar, p.bio, p.interests,
    p.mood_preference, p.region, p.availability,
    p.character_title, p.character_description, p.character_personality, p.character_life_story,
    CASE WHEN p.presence_status = 'invisible' THEN false ELSE p.is_online END AS is_online,
    CASE WHEN p.presence_status = 'invisible' THEN NULL ELSE p.last_seen_at END AS last_seen_at,
    p.gender, p.mode_preference,
    CASE WHEN p.presence_status = 'invisible' THEN 'online'::public.presence_status ELSE p.presence_status END AS presence_status,
    p.looking_for, p.gender_preference,
    p.location_preference, p.country, p.city, p.age,
    p.preferred_languages, p.primary_language
  FROM public.profiles p
  WHERE p.is_suspended = false
    AND p.profile_paused = false
    AND p.hidden_from_discovery = false
    AND NOT public.is_blocked(COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), p.user_id)
    AND NOT public.is_restricted(p.user_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
$$;
