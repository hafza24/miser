
-- Drop the overly permissive policy we just created
DROP POLICY IF EXISTS "Authenticated can read profiles via view" ON public.profiles;

-- Drop the view approach
DROP VIEW IF EXISTS public.public_profiles;

-- Create a SECURITY DEFINER function that returns only safe public fields
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE(
  user_id uuid,
  alias text,
  emoji_avatar text,
  bio text,
  interests text[],
  mood_preference text,
  region text,
  availability text,
  character_title text,
  character_description text,
  character_personality text[],
  character_life_story text,
  is_online boolean,
  last_seen_at timestamptz,
  gender text,
  mode_preference mode_preference
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.alias,
    p.emoji_avatar,
    p.bio,
    p.interests,
    p.mood_preference,
    p.region,
    p.availability,
    p.character_title,
    p.character_description,
    p.character_personality,
    p.character_life_story,
    p.is_online,
    p.last_seen_at,
    p.gender,
    p.mode_preference
  FROM public.profiles p
  WHERE p.is_suspended = false
$$;

-- Also create a function for looking up specific users' public info (for chat pages)
CREATE OR REPLACE FUNCTION public.get_public_profile_by_ids(user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  alias text,
  emoji_avatar text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.alias, p.emoji_avatar
  FROM public.profiles p
  WHERE p.user_id = ANY(user_ids)
    AND p.is_suspended = false
$$;
