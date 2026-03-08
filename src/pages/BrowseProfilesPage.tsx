import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Send, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface BrowseProfile {
  user_id: string;
  alias: string;
  emoji_avatar: string;
  bio: string | null;
  interests: string[] | null;
  mood_preference: string | null;
  region: string | null;
  availability: string | null;
}

const BrowseProfilesPage = () => {
  const { user } = useAuth();
  const { mode } = useMode();
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadProfiles();
    loadSentRequests();
  }, [user]);

  const loadProfiles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar, bio, interests, mood_preference, region, availability')
      .neq('user_id', user.id)
      .eq('is_suspended', false)
      .limit(50);
    setProfiles(data || []);
    setLoading(false);
  };

  const loadSentRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_requests')
      .select('receiver_id, status')
      .eq('sender_id', user.id);
    if (data) {
      const pending = new Set(data.filter(r => r.status === 'pending' || r.status === 'accepted').map(r => r.receiver_id));
      setSentRequests(pending);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    setSendingTo(receiverId);
    const { error } = await supabase
      .from('chat_requests')
      .insert({ sender_id: user.id, receiver_id: receiverId });
    setSendingTo(null);
    if (error) {
      if (error.code === '23505') {
        toast.info('Request already sent');
      } else {
        toast.error('Failed to send request');
      }
    } else {
      setSentRequests(prev => new Set([...prev, receiverId]));
      toast.success('Chat request sent!');
    }
  };

  const filtered = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.alias.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.interests?.some(i => i.toLowerCase().includes(q)) ||
      p.region?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="p-4">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold text-foreground mb-1">
            {mode === 'light' ? '🌸 Discover People' : '🔮 Discover People'}
          </h2>
          <p className="text-sm text-muted-foreground">Browse anonymous profiles and send chat requests</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by alias, interests, region..."
            className="pl-10"
            maxLength={100}
          />
        </div>

        {/* Profiles grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading profiles...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-muted-foreground">No profiles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const alreadySent = sentRequests.has(p.user_id);
              return (
                <div
                  key={p.user_id}
                  className="flex items-start gap-3 p-4 rounded-xl bg-card shadow-card border border-border"
                >
                  <div className="text-3xl flex-shrink-0">{p.emoji_avatar}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{p.alias}</h3>
                    {p.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{p.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.mood_preference && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {p.mood_preference}
                        </span>
                      )}
                      {p.region && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          📍 {p.region}
                        </span>
                      )}
                      {p.availability && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          🕐 {p.availability}
                        </span>
                      )}
                      {p.interests?.slice(0, 3).map((interest) => (
                        <span
                          key={interest}
                          className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadySent ? 'secondary' : 'default'}
                    disabled={alreadySent || sendingTo === p.user_id}
                    onClick={() => sendRequest(p.user_id)}
                    className="flex-shrink-0 gap-1.5"
                  >
                    {alreadySent ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Sent
                      </>
                    ) : sendingTo === p.user_id ? (
                      <>
                        <Clock className="h-3.5 w-3.5 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Chat
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BrowseProfilesPage;
