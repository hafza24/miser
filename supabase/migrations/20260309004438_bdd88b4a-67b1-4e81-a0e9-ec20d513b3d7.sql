
ALTER TABLE public.profiles
ADD COLUMN character_title text,
ADD COLUMN character_description text,
ADD COLUMN character_personality text[] DEFAULT '{}',
ADD COLUMN character_life_story text;
