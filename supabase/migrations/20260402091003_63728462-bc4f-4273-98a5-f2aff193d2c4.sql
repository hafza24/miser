
-- ============================================
-- FIX 1: Profile data exposure - create a safe view
-- ============================================

-- Create a view that only exposes safe public fields
CREATE OR REPLACE VIEW public.public_profiles AS
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

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view other profiles limited" ON public.profiles;

-- Add a restricted policy: users can only view other profiles via the view
-- Admins retain full access via existing admin policy

-- ============================================
-- FIX 2: Subscription privilege escalation
-- ============================================

-- Add a BEFORE INSERT trigger that forces status to 'pending' and validates plan_id
CREATE OR REPLACE FUNCTION public.enforce_subscription_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can set arbitrary status
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    -- Validate plan_id exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = NEW.plan_id AND is_active = true) THEN
      RAISE EXCEPTION 'Invalid or inactive plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_subscription_defaults_trigger
BEFORE INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_subscription_defaults();

-- ============================================
-- FIX 3: Payment screenshots storage exposure
-- ============================================

-- Drop existing overly permissive SELECT policy on storage
DROP POLICY IF EXISTS "Authenticated users can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view payment screenshots" ON storage.objects;

-- Owner-scoped read policy
CREATE POLICY "Users can view own payment screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin read policy
CREATE POLICY "Admins can view all payment screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
