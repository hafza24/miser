
-- 1. Create subscription_plans table (admin-managed)
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  daily_chat_limit integer NOT NULL DEFAULT 3,
  daily_scene_limit integer NOT NULL DEFAULT 10,
  dark_mode_access boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins can view all plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert plans" ON public.subscription_plans
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans" ON public.subscription_plans
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plans" ON public.subscription_plans
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 2. Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  start_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  auto_renew boolean NOT NULL DEFAULT false,
  billing_period text NOT NULL DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 3. Create payments table (replaces payment_requests for new flow)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id),
  amount numeric(10,2) NOT NULL,
  method text NOT NULL,
  transaction_id text,
  proof_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 4. Function to check active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND expiry_date > now()
  )
$$;

-- 5. Function to get user's active plan limits
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(_user_id uuid)
RETURNS TABLE(daily_chat_limit integer, daily_scene_limit integer, dark_mode_access boolean, plan_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.daily_chat_limit, sp.daily_scene_limit, sp.dark_mode_access, sp.name
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status = 'active'
    AND s.expiry_date > now()
  ORDER BY sp.sort_order DESC
  LIMIT 1
$$;

-- 6. Trigger to update updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Enable realtime for subscriptions (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
