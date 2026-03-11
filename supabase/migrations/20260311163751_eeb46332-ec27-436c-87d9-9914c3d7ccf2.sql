
ALTER TABLE public.profiles 
ADD COLUMN scheduled_deletion_at timestamp with time zone DEFAULT NULL;
