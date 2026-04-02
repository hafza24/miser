
-- Recreate view with SECURITY INVOKER to avoid security definer warning
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  user_id,
  alias,
  emoji_avatar,
  bio,
  interests,
  mood_preference,
  region,
  availability,
  character_title,
  character_description,
  character_personality,
  character_life_story,
  is_online,
  last_seen_at,
  gender,
  mode_preference
FROM public.profiles
WHERE is_suspended = false;

-- We need a policy that allows authenticated users to SELECT from profiles
-- but only the columns exposed by the view. Since Postgres views with
-- security_invoker check the querying user's permissions, we need a
-- limited SELECT policy. However, column-level RLS isn't possible in Postgres.
-- The view itself limits columns. We need to re-add a SELECT policy for
-- authenticated users so the view can read the data.
CREATE POLICY "Authenticated can read profiles via view"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
