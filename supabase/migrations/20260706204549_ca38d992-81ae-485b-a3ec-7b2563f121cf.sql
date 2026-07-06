
UPDATE auth.users SET email_confirmed_at = now() WHERE email='user@mail.com' AND email_confirmed_at IS NULL;
UPDATE public.profiles SET age_verified = true WHERE user_id = (SELECT id FROM auth.users WHERE email='user@mail.com');
