ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.payment_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_requests;