
-- 1. Blocklist table
CREATE TABLE IF NOT EXISTS public.blocked_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_emails_email_lower
  ON public.blocked_emails (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_emails TO authenticated;
GRANT ALL ON public.blocked_emails TO service_role;

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blocked emails"
  ON public.blocked_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert blocked emails"
  ON public.blocked_emails FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update blocked emails"
  ON public.blocked_emails FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blocked emails"
  ON public.blocked_emails FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Signup guard trigger on auth.users
CREATE OR REPLACE FUNCTION public.reject_blocked_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocked_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email address has been banned from Fur&Fir.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_blocked_signup ON auth.users;
CREATE TRIGGER trg_reject_blocked_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_signup();

-- 3. Admin helper: block a user's email (typically called before deleting the account)
CREATE OR REPLACE FUNCTION public.admin_block_email(p_email TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email required';
  END IF;
  INSERT INTO public.blocked_emails (email, reason, blocked_by)
  VALUES (lower(trim(p_email)), p_reason, auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET reason = COALESCE(EXCLUDED.reason, public.blocked_emails.reason);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_block_email(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_block_email(TEXT, TEXT) TO authenticated;
