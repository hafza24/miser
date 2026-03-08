import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Users, MessageCircle, Check, X, Inbox, SendHorizontal, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ChatItem {
  id: string;
  mode: string;
  is_group: boolean;
  created_at: string;
  last_message?: string;
  participants: { alias: string; emoji_avatar: string }[];
}

interface ChatRequest {
  id: string;
  sender_id: string;
  status: string;
  created_at: string;
  sender_alias?: string;
  sender_emoji?: string;
}

interface SentRequest {
  id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  receiver_alias?: string;
  receiver_emoji?: string;
}

const DashboardPage = () => {
  const { user, profile } = useAuth();
  const { mode } = useMode();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadChats();
    loadRequests();
    loadSentRequests();
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setLoading(false);
      return;
    }

    const chatIds = participations.map(p => p.chat_id);
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('created_at', { ascending: false });

    if (chatData) {
      const enriched = await Promise.all(
        chatData.map(async (chat) => {
          const { data: parts } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', chat.id);

          const otherUserIds = (parts || [])
            .map(p => p.user_id)
            .filter(id => id !== user.id);

          let participants: { alias: string; emoji_avatar: string }[] = [];
          if (otherUserIds.length) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('alias, emoji_avatar')
              .in('user_id', otherUserIds);
            participants = profiles || [];
          }

          const { data: msgs } = await supabase
            .from('messages')
            .select('content')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...chat,
            participants,
            last_message: msgs?.[0]?.content,
          };
        })
      );
      setChats(enriched);
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_requests')
      .select('id, sender_id, status, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const senderIds = data.map(r => r.sender_id);
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar')
        .in('user_id', senderIds);

      const enriched = data.map(r => {
        const sp = senderProfiles?.find(p => p.user_id === r.sender_id);
        return {
          ...r,
          sender_alias: sp?.alias || 'Anonymous',
          sender_emoji: sp?.emoji_avatar || '💫',
        };
      });
      setRequests(enriched);
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    if (!user) return;
    setRespondingTo(requestId);
    const req = requests.find(r => r.id === requestId);

    if (accept && req) {
      // Create chat and add both participants
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: chat, error: chatErr } = await supabase
        .from('chats')
        .insert({ mode: mode as 'light' | 'dark', expires_at: expiresAt } as any)
        .select()
        .single();

      if (chat && !chatErr) {
        // Insert current user first, then the other user (sequential for RLS)
        await supabase.from('chat_participants').insert({ chat_id: chat.id, user_id: user.id });
        await supabase.from('chat_participants').insert({ chat_id: chat.id, user_id: req.sender_id });
      }
    }

    await supabase
      .from('chat_requests')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', requestId);

    setRespondingTo(null);
    setRequests(prev => prev.filter(r => r.id !== requestId));
    toast.success(accept ? 'Request accepted! Chat created.' : 'Request declined.');
    if (accept) loadChats();
  };

  return (
    <AppLayout>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {mode === 'light' ? '🌞 Light Space' : '🌑 Dark Space'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'light' ? 'Emotional connections' : '18+ connections'}
            </p>
          </div>
          <Button onClick={() => navigate('/browse')} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Find People
          </Button>
        </div>

        {/* Incoming Requests */}
        {requests.length > 0 && (
          <div className="mb-6">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Chat Requests ({requests.length})
            </h3>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border"
                >
                  <div className="text-2xl">{req.sender_emoji}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{req.sender_alias}</span>
                    <p className="text-xs text-muted-foreground">wants to chat with you</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="default"
                      className="h-8 w-8"
                      disabled={respondingTo === req.id}
                      onClick={() => respondToRequest(req.id, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={respondingTo === req.id}
                      onClick={() => respondToRequest(req.id, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood chips for light mode */}
        {mode === 'light' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['💛 Emotional Support', '🤝 Friendship', '💕 Cute Love'].map(mood => (
              <button
                key={mood}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {mood}
              </button>
            ))}
          </div>
        )}

        {/* Dark mode categories */}
        {mode === 'dark' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['💋 Flirting', '🔥 Passionate Romance', '✨ Fantasy Roleplay'].map(cat => (
              <button
                key={cat}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors neon-glow"
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Chat list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Loading chats...
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{mode === 'light' ? '🌸' : '🌙'}</div>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
              No conversations yet
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Browse profiles and send chat requests to connect
            </p>
            <Button onClick={() => navigate('/browse')} className="gap-2">
              <Plus className="h-4 w-4" />
              Find People
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted transition-colors text-left shadow-card"
              >
                <div className="text-2xl">
                  {chat.participants[0]?.emoji_avatar || '💬'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {chat.participants.map(p => p.alias).join(', ') || 'Anonymous'}
                    </span>
                    {chat.is_group && <Users className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message || 'No messages yet'}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
