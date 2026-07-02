
-- Adjust subscription defaults trigger to allow system-inserted rows (auth.uid() IS NULL)
CREATE OR REPLACE FUNCTION public.enforce_subscription_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = NEW.plan_id AND is_active = true) THEN
      RAISE EXCEPTION 'Invalid or inactive plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Extend handle_new_user to auto-subscribe to Free plan (long expiry)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_free_plan_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, email, alias, emoji_avatar)
  VALUES (NEW.id, NEW.email, public.generate_alias(), public.generate_emoji_avatar());

  SELECT id INTO v_free_plan_id
  FROM public.subscription_plans
  WHERE is_active = true AND (lower(name) = 'free' OR price_monthly = 0)
  ORDER BY (lower(name) = 'free') DESC, sort_order ASC
  LIMIT 1;

  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, plan_id, start_date, expiry_date, status, auto_renew, billing_period)
    VALUES (NEW.id, v_free_plan_id, now(), now() + interval '100 years', 'active', false, 'monthly');
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: give existing users without any subscription the Free plan
INSERT INTO public.subscriptions (user_id, plan_id, start_date, expiry_date, status, auto_renew, billing_period)
SELECT p.user_id,
       (SELECT id FROM public.subscription_plans WHERE is_active = true AND (lower(name)='free' OR price_monthly=0) ORDER BY (lower(name)='free') DESC, sort_order ASC LIMIT 1),
       now(), now() + interval '100 years', 'active', false, 'monthly'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.user_id)
  AND EXISTS (SELECT 1 FROM public.subscription_plans WHERE is_active = true AND (lower(name)='free' OR price_monthly=0));
