
UPDATE public.subscription_plans SET sort_order = 0 WHERE name = 'Free';
UPDATE public.subscription_plans SET sort_order = 2 WHERE name = 'Starter';
UPDATE public.subscription_plans SET sort_order = 4 WHERE name = 'Premium';

INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, daily_chat_limit, daily_scene_limit, monthly_chat_limit, monthly_scene_limit, monthly_group_limit, dark_mode_access, is_active, sort_order)
VALUES
  ('Plus', 'More chats & scenes for regular users', 3.50, 35.00, 25, 75, 500, 500, 20, true, true, 3),
  ('Elite', 'Unlimited-feel access for power users', 9.00, 90.00, 200, 300, 5000, 5000, 100, true, true, 5),
  ('Lifetime', 'One-time payment, lifetime access', 199.00, 199.00, 500, 500, 15000, 15000, 500, true, true, 6);
