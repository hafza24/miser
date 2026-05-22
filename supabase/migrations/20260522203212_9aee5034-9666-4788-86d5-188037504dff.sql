CREATE OR REPLACE FUNCTION public.user_has_dark_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT sp.dark_mode_access
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.user_id = _user_id
        AND s.status = 'active'
        AND s.expiry_date > now()
      ORDER BY sp.sort_order DESC
      LIMIT 1
    ),
    false
  )
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_dark_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_dark_access(uuid) TO authenticated;