import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Send, Check, Clock, X } from 'lucide-react';
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

type RequestStatus = 'none' | 'pending' | 'accepted' | 'declined';

interface RequestInfo {
  id: string;
  status: RequestStatus;
}

const BrowseProfilesPage = () => {
  const { user } = useAuth();
  const { mode } = useMode();
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestMap, setRequestMap] = useState<Record<string, RequestInfo>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadProfiles();
    loadMyRequests();
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

  const loadMyRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_requests')
      .select('id, receiver_id, status')
      .eq('sender_id', user.id);

    if (data) {
      const map: Record<string, RequestInfo> = {};
      data.forEach(r => {
        map[r.receiver_id] = { id: r.id, status: r.status as RequestStatus };
      });
      setRequestMap(map);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    setActionId(receiverId);
    const { data, error } = await supabase
      .from('chat_requests')
      .insert({ sender_id: user.id, receiver_id: receiverId })
      .select('id')
      .single();

    setActionId(null);
    if (error) {
      if (error.code === '23505') {
        toast.info('Request already sent');
      } else {
        toast.error('Failed to send request');
      }
    } else if (data) {
      setRequestMap(prev => ({
        ...prev,
        [receiverId]: { id: data.id, status: 'pending' },
      }));
      toast.success('Chat request sent!');
    }
  };

  const cancelRequest = async (receiverId: string) => {
    const info = requestMap[receiverId];
    if (!info) return;
    setActionId(receiverId);

    const { error } = await supabase
      .from('chat_requests')
      .delete()
      .eq('id', info.id);

    setActionId(null);
    if (error) {
      toast.error('Failed to cancel');
    } else {
      setRequestMap(prev => {
        const next = { ...prev };
        delete next[receiverId];
        return next;
      });
      toast.success('Request cancelled');
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

  const renderRequestButton = (profile: BrowseProfile) => {
    const info = requestMap[profile.user_id];
    const status: RequestStatus = info?.status as RequestStatus || 'none';
    const isActing = actionId === profile.user_id;

    if (status === 'accepted') {
      return (
        <Button size="sm" variant="secondary" disabled className="flex-shrink-0 gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Connected
        </Button>
      );
    }

    if (status === 'pending') {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={isActing}
          onClick={() => cancelRequest(profile.user_id)}
          className="flex-shrink-0 gap-1.5 text-muted-foreground"
        >
          <Clock className="h-3.5 w-3.5" />
          Pending
          <X className="h-3 w-3 ml-0.5" />
        </Button>
      );
    }

    if (status === 'declined') {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={isActing}
          onClick={() => cancelRequest(profile.user_id)}
          className="flex-shrink-0 gap-1.5 text-destructive"
        >
          <X className="h-3.5 w-3.5" />
          Declined
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="default"
        disabled={isActing}
        onClick={() => sendRequest(profile.user_id)}
        className="flex-shrink-0 gap-1.5"
      >
        {isActing ? (
          <Clock className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {isActing ? 'Sending' : 'Chat'}
      </Button>
    );
  };

  return (
    <AppLayout>
      <div className="p-4">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold text-foreground mb-1">
            {mode === 'light' ? '🌸 Discover People' : '🔮 Discover People'}
          </h2>
          <p className="text-sm text-muted-foreground">Browse anonymous profiles and send chat requests</p>
        </div>

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

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading profiles...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-muted-foreground">No profiles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
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
                {renderRequestButton(p)}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BrowseProfilesPage;
