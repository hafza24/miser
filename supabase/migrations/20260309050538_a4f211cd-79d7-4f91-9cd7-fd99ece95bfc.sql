
-- Security definer function to record a report against a user and auto-suspend at 5
CREATE OR REPLACE FUNCTION public.record_user_report(_reported_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET violation_count = violation_count + 1,
      is_suspended = CASE WHEN violation_count + 1 >= 5 THEN true ELSE is_suspended END
  WHERE user_id = _reported_user_id;
END;
$$;
