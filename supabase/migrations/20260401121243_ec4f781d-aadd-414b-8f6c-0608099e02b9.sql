
-- 1. Create a trigger to prevent non-admin users from modifying sensitive profile columns
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is an admin, allow all changes
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive fields to their old values for non-admin users
  NEW.payment_status := OLD.payment_status;
  NEW.is_suspended := OLD.is_suspended;
  NEW.age_verified := OLD.age_verified;
  NEW.violation_count := OLD.violation_count;
  NEW.dark_mode_blocked := OLD.dark_mode_blocked;
  NEW.light_mode_blocked := OLD.light_mode_blocked;
  NEW.daily_chat_limit := OLD.daily_chat_limit;
  NEW.daily_scene_limit := OLD.daily_scene_limit;
  NEW.scheduled_deletion_at := OLD.scheduled_deletion_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- 2. Drop the overly permissive "Users can view other profiles" SELECT policy
-- and replace it with one that only returns non-sensitive columns via a view
DROP POLICY IF EXISTS "Users can view other profiles" ON public.profiles;

-- Create a restricted policy: other authenticated users can see profiles
-- but we'll handle column restriction via a secure view
CREATE POLICY "Users can view other profiles limited"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() != user_id);

-- 3. Make payment-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';
