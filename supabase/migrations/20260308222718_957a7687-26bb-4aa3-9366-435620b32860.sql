
-- Create enum for mode preference
CREATE TYPE public.mode_preference AS ENUM ('light', 'dark');

-- Create enum for violation type
CREATE TYPE public.violation_type AS ENUM ('warning', 'mute', 'suspension');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Users profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  alias TEXT NOT NULL,
  emoji_avatar TEXT NOT NULL DEFAULT '🙂',
  mode_preference mode_preference NOT NULL DEFAULT 'light',
  age_verified BOOLEAN NOT NULL DEFAULT false,
  interests TEXT[],
  mood_preference TEXT,
  region TEXT,
  availability TEXT,
  bio TEXT,
  violation_count INTEGER NOT NULL DEFAULT 0,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
-- Allow users to see other profiles (alias + emoji only, controlled in app)
CREATE POLICY "Users can view other profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chats table
CREATE TABLE public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode mode_preference NOT NULL DEFAULT 'light',
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Chat participants table
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats they participate in" ON public.chats FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_participants.chat_id = chats.id AND chat_participants.user_id = auth.uid())
);
CREATE POLICY "Authenticated users can create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view their participations" ON public.chat_participants FOR SELECT TO authenticated USING (user_id = auth.uid() OR chat_id IN (SELECT cp.chat_id FROM public.chat_participants cp WHERE cp.user_id = auth.uid()));
CREATE POLICY "Authenticated users can join chats" ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave chats" ON public.chat_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  self_destruct_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their chats" ON public.messages FOR SELECT TO authenticated USING (
  chat_id IN (SELECT cp.chat_id FROM public.chat_participants cp WHERE cp.user_id = auth.uid())
);
CREATE POLICY "Users can send messages to their chats" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND chat_id IN (SELECT cp.chat_id FROM public.chat_participants cp WHERE cp.user_id = auth.uid())
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Moderation logs
CREATE TABLE public.moderation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  violation_type violation_type NOT NULL,
  message_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own moderation logs" ON public.moderation_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Function to generate random alias
CREATE OR REPLACE FUNCTION public.generate_alias()
RETURNS TEXT AS $$
DECLARE
  prefixes TEXT[] := ARRAY['Velvet', 'Moon', 'Silent', 'Crystal', 'Shadow', 'Golden', 'Cosmic', 'Mystic', 'Ocean', 'Star', 'Dream', 'Night', 'Silver', 'Ember', 'Azure'];
  suffixes TEXT[] := ARRAY['Soul', 'Dreamer', 'Rose', 'Phoenix', 'Wolf', 'Spirit', 'Flame', 'Heart', 'Echo', 'Storm', 'Whisper', 'Glow', 'Spark', 'Tide', 'Mist'];
  num INTEGER;
BEGIN
  num := floor(random() * 99 + 1);
  RETURN prefixes[floor(random() * array_length(prefixes, 1) + 1)] || suffixes[floor(random() * array_length(suffixes, 1) + 1)] || num::TEXT;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate random emoji
CREATE OR REPLACE FUNCTION public.generate_emoji_avatar()
RETURNS TEXT AS $$
DECLARE
  emojis TEXT[] := ARRAY['🙂', '😈', '🐼', '🌙', '🐯', '🦊', '💫', '🦋', '🌸', '🔥', '🌊', '⭐', '🎭', '🦄', '🐺'];
BEGIN
  RETURN emojis[floor(random() * array_length(emojis, 1) + 1)];
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, alias, emoji_avatar)
  VALUES (NEW.id, NEW.email, public.generate_alias(), public.generate_emoji_avatar());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
