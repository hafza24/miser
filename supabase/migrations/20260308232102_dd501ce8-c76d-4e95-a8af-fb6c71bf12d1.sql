-- Allow deletion of chats for service role cleanup
CREATE POLICY "Service role can delete chats"
ON public.chats
FOR DELETE
TO service_role
USING (true);

-- Allow service role to delete timer_stop_requests
CREATE POLICY "Service role can delete timer stop requests"
ON public.timer_stop_requests
FOR DELETE
TO service_role
USING (true);

-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;