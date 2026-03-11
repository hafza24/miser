
ALTER TABLE public.profiles 
ADD COLUMN light_mode_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN dark_mode_blocked boolean NOT NULL DEFAULT false;
