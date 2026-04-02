
-- 1. Fix profiles SELECT policy: change from public to authenticated
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Fix profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Fix profiles DELETE policy
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 2. Ensure protect_sensitive_profile_fields trigger exists
DROP TRIGGER IF EXISTS protect_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- 3. Ensure enforce_subscription_defaults trigger exists
DROP TRIGGER IF EXISTS enforce_subscription_defaults_trigger ON public.subscriptions;
CREATE TRIGGER enforce_subscription_defaults_trigger
BEFORE INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_subscription_defaults();

-- 4. Add enforce_payment_defaults trigger
CREATE OR REPLACE FUNCTION public.enforce_payment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_defaults_trigger ON public.payments;
CREATE TRIGGER enforce_payment_defaults_trigger
BEFORE INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_defaults();

-- 5. Fix chat_requests policies: change from public to authenticated
DROP POLICY IF EXISTS "Users can view their sent requests" ON public.chat_requests;
CREATE POLICY "Users can view their sent requests"
ON public.chat_requests FOR SELECT TO authenticated
USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their received requests" ON public.chat_requests;
CREATE POLICY "Users can view their received requests"
ON public.chat_requests FOR SELECT TO authenticated
USING (receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send chat requests" ON public.chat_requests;
CREATE POLICY "Users can send chat requests"
ON public.chat_requests FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Receiver can respond to requests" ON public.chat_requests;
CREATE POLICY "Receiver can respond to requests"
ON public.chat_requests FOR UPDATE TO authenticated
USING (receiver_id = auth.uid());

-- 6. Fix mode_switch_requests policies: change from public to authenticated
DROP POLICY IF EXISTS "Users can create mode switch requests" ON public.mode_switch_requests;
CREATE POLICY "Users can create mode switch requests"
ON public.mode_switch_requests FOR INSERT TO authenticated
WITH CHECK ((sender_id = auth.uid()) AND is_chat_participant(auth.uid(), chat_id));

DROP POLICY IF EXISTS "Users can view mode switch requests in their chats" ON public.mode_switch_requests;
CREATE POLICY "Users can view mode switch requests in their chats"
ON public.mode_switch_requests FOR SELECT TO authenticated
USING (is_chat_participant(auth.uid(), chat_id));

DROP POLICY IF EXISTS "Users can respond to mode switch requests" ON public.mode_switch_requests;
CREATE POLICY "Users can respond to mode switch requests"
ON public.mode_switch_requests FOR UPDATE TO authenticated
USING (is_chat_participant(auth.uid(), chat_id) AND (sender_id <> auth.uid()));

DROP POLICY IF EXISTS "Service role can delete mode switch requests" ON public.mode_switch_requests;
CREATE POLICY "Service role can delete mode switch requests"
ON public.mode_switch_requests FOR DELETE TO service_role
USING (true);

-- 7. Fix chat_participants UPDATE policy from public to authenticated
DROP POLICY IF EXISTS "Users can update their own participation" ON public.chat_participants;
CREATE POLICY "Users can update their own participation"
ON public.chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
