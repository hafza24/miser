import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  alias: string;
  emoji_avatar: string;
  mode_preference: 'light' | 'dark';
  age_verified: boolean;
  interests: string[] | null;
  mood_preference: string | null;
  region: string | null;
  availability: string | null;
  bio: string | null;
  violation_count: number;
  is_suspended: boolean;
  character_title: string | null;
  character_description: string | null;
  character_personality: string[] | null;
  character_life_story: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  gender: string | null;
  dark_mode_blocked: boolean;
  light_mode_blocked: boolean;
  payment_status: string;
  receive_group_invites: boolean;
  primary_language?: string | null;
  secondary_language?: string | null;
  auto_translate_enabled?: boolean;
  scheduled_deletion_at?: string | null;
  muted_until?: string | null;
  // M1: presence, discovery, matching, notification prefs
  presence_status: 'online' | 'away' | 'busy' | 'invisible';
  profile_paused: boolean;
  hidden_from_discovery: boolean;
  looking_for: string[];
  gender_preference: 'male' | 'female' | 'any';
  location_preference: 'near_me' | 'same_city' | 'same_country' | 'worldwide';
  country: string | null;
  city: string | null;
  age: number | null;
  age_min: number | null;
  age_max: number | null;
  preferred_languages: string[];
  notify_messages: boolean;
  notify_matches: boolean;
  notify_group_invites_pref: boolean;
  notify_mentions: boolean;
  notify_requests: boolean;
  notify_marketing: boolean;
  notify_expiry: boolean;
}


interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const updateOnlineStatus = useCallback(async (userId: string, isOnline: boolean) => {
    await supabase
      .from('profiles')
      .update({ 
        is_online: isOnline, 
        last_seen_at: new Date().toISOString() 
      })
      .eq('user_id', userId);
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) {
      // Cancel scheduled deletion on login
      if ((data as any).scheduled_deletion_at) {
        await supabase
          .from('profiles')
          .update({ scheduled_deletion_at: null } as any)
          .eq('user_id', userId);
        (data as any).scheduled_deletion_at = null;
      }
      // Enforce dark mode lock immediately — if blocked, force light mode
      if ((data as any).dark_mode_blocked && (data as any).mode_preference === 'dark') {
        (data as any).mode_preference = 'light';
        await supabase
          .from('profiles')
          .update({ mode_preference: 'light' })
          .eq('user_id', userId);
        // Also update localStorage so ModeContext picks it up
        localStorage.setItem('mrsmrb-mode', 'light');
        document.documentElement.classList.remove('dark-mode');
      }
      setProfile(data as Profile);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // Handle visibility change and beforeunload
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateOnlineStatus(user.id, false);
      } else if (document.visibilityState === 'visible') {
        updateOnlineStatus(user.id, true);
      }
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status on page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}`;
      const body = JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() });
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    };

    // Set online when component mounts with user
    updateOnlineStatus(user.id, true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, updateOnlineStatus]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          updateOnlineStatus(session.user.id, true);
        }, 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        updateOnlineStatus(session.user.id, true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [updateOnlineStatus]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (user) {
      await updateOnlineStatus(user.id, false);
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
