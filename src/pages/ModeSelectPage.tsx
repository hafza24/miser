import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sun, Moon, ShieldAlert, Lock } from 'lucide-react';
import { toast } from 'sonner';

const ModeSelectPage = () => {
  const { setMode } = useMode();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [lightBlocked, setLightBlocked] = useState(false);
  const [darkBlocked, setDarkBlocked] = useState(false);

  useEffect(() => {
    const loadRestrictions = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('light_mode_blocked, dark_mode_blocked')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setLightBlocked((data as any).light_mode_blocked ?? false);
        setDarkBlocked((data as any).dark_mode_blocked ?? false);
      }
    };
    loadRestrictions();
  }, [user]);

  const selectMode = async (mode: 'light' | 'dark') => {
    if (mode === 'light' && lightBlocked) {
      toast.error('Your access to Light mode has been restricted by an admin.');
      return;
    }
    if (mode === 'dark' && darkBlocked) {
      navigate('/unlock-dark-mode');
      return;
    }
    setMode(mode);
    if (user) {
      await supabase
        .from('profiles')
        .update({ mode_preference: mode })
        .eq('user_id', user.id);
      await refreshProfile();
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl font-bold text-foreground">Choose Your Mode</h1>
          <p className="text-muted-foreground mt-2">You can switch anytime in Settings</p>
        </div>

        <div className="grid gap-4">
          {/* Light Mode */}
          <button
            onClick={() => selectMode('light')}
            className={`group relative overflow-hidden rounded-2xl border-2 border-border p-8 text-left transition-all bg-card ${lightBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:shadow-soft'}`}
          >
            {lightBlocked && (
              <div className="absolute top-3 right-3 flex items-center gap-1 text-destructive text-xs font-medium">
                <ShieldAlert className="h-3.5 w-3.5" /> Restricted
              </div>
            )}
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(340 65% 90%), hsl(270 40% 90%))' }}>
                <Sun className="h-7 w-7 text-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">🌞 Light Mode</h2>
                <span className="text-sm text-muted-foreground">Emotional & Friendship</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Safe space for emotional support, friendship, and soft romance. No explicit content.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Emotional Support', 'Friendship', 'Cute Love'].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => selectMode('dark')}
            className={`group relative overflow-hidden rounded-2xl border-2 border-border p-8 text-left transition-all bg-card ${darkBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:shadow-soft'}`}
          >
            {darkBlocked && (
              <div className="absolute top-3 right-3 flex items-center gap-1 text-primary text-xs font-medium">
                <Lock className="h-3.5 w-3.5" /> Premium
              </div>
            )}
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-muted">
                <Moon className="h-7 w-7 text-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">🌑 Dark Mode</h2>
                <span className="text-sm text-muted-foreground">18+ Romance & Flirting</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Consensual flirting, passionate romance, and fantasy roleplay. Adults only.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Flirting', 'Passionate Romance', 'Fantasy Roleplay'].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectPage;
