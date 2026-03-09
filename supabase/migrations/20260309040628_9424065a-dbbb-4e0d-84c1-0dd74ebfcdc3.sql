-- Add online status columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_online boolean NOT NULL DEFAULT false,
ADD COLUMN last_seen_at timestamp with time zone DEFAULT now();

-- Create index for faster online user queries
CREATE INDEX idx_profiles_is_online ON public.profiles(is_online);