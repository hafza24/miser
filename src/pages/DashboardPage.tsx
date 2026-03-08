import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus, Users, MessageCircle, Check, X,
  Inbox, SendHorizontal, Clock, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatItem {
  id: string;
  mode: string;
  is_group: boolean;
  created_at: string;
  expires_at: string | null;
  timer_stopped: boolean;
  last_message?: string;
  participants: { alias: string; emoji_avatar: string }[];
}

interface IncomingRequest {
  id: string;
  sender_id: string;
  status: string;
  created_at: string;
  alias: string;
  emoji: string;
}

interface SentRequest {
  id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  alias: string;
  emoji: string;
}

const DashboardPage = () => {
  const { user } = useAuth();
  const { mode } = useMode();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([loadChats(), loadIncoming(), loadSent()]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void reload();
      }, 200);
    };

    const channel = supabase
      .channel(`dashboard-live-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, scheduleReload)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_requests',
        filter: `sender_id=eq.${user.id}`,
      }, scheduleReload)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, scheduleReload)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [user, reload]);

  // ─── Load chats ───
  const loadChats = async () => {
    if (!user) return;
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setChats([]);
      return;
    }

    const chatIds = participations.map(p => p.chat_id);
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('created_at', { ascending: false });

    if (!chatData) { setChats([]); return; }

    const enriched: ChatItem[] = await Promise.all(
      chatData.map(async (chat: any) => {
        const { data: parts } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('chat_id', chat.id);

        const otherIds = (parts || []).map(p => p.user_id).filter(id => id !== user.id);
        let participants: { alias: string; emoji_avatar: string }[] = [];
        if (otherIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('alias, emoji_avatar')
            .in('user_id', otherIds);
          participants = profiles || [];
        }

        const { data: msgs } = await supabase
          .from('messages')
          .select('content')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          id: chat.id,
          mode: chat.mode,
          is_group: chat.is_group,
          created_at: chat.created_at,
          expires_at: chat.expires_at,
          timer_stopped: chat.timer_stopped,
          participants,
          last_message: msgs?.[0]?.content,
        };
      })
    );
    setChats(enriched);
  };

  // ─── Load incoming requests ───
  const loadIncoming = async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('chat_requests')
      .select('id, sender_id, status, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (!data?.length) { setIncoming([]); return; }

    const ids = data.map(r => r.sender_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar')
      .in('user_id', ids);

    setIncoming(data.map(r => {
      const p = profiles?.find(p => p.user_id === r.sender_id);
      return { ...r, alias: p?.alias || 'Anonymous', emoji: p?.emoji_avatar || '💫' };
    }));
  };

  // ─── Load sent requests ───
  const loadSent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_requests')
      .select('id, receiver_id, status, created_at')
      .eq('sender_id', user.id)
      .in('status', ['pending', 'declined'])
      .order('created_at', { ascending: false });

    if (!data?.length) { setSent([]); return; }

    const ids = data.map(r => r.receiver_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar')
      .in('user_id', ids);

    setSent(data.map(r => {
      const p = profiles?.find(p => p.user_id === r.receiver_id);
      return { ...r, alias: p?.alias || 'Anonymous', emoji: p?.emoji_avatar || '💫' };
    }));
  };

  // ─── Accept / Decline incoming ───
  const respondToRequest = async (requestId: string, accept: boolean) => {
    if (!user) return;
    setActionId(requestId);
    const req = incoming.find(r => r.id === requestId);

    try {
      if (accept && req) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: chat, error: chatErr } = await supabase
          .from('chats')
          .insert({ mode: mode as 'light' | 'dark', expires_at: expiresAt } as any)
          .select()
          .single();

        if (chatErr) throw chatErr;

        if (chat) {
          const { error: e1 } = await supabase
            .from('chat_participants')
            .insert({ chat_id: chat.id, user_id: user.id });
          if (e1) throw e1;

          const { error: e2 } = await supabase
            .from('chat_participants')
            .insert({ chat_id: chat.id, user_id: req.sender_id });
          if (e2) throw e2;
        }
      }

      await supabase
        .from('chat_requests')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', requestId);

      toast.success(accept ? 'Request accepted! Chat created.' : 'Request declined.');
      setIncoming(prev => prev.filter(r => r.id !== requestId));
      if (accept) await loadChats();
    } catch (err: any) {
      toast.error('Something went wrong: ' + (err.message || 'Unknown error'));
    }
    setActionId(null);
  };

  // ─── Cancel sent request ───
  const cancelRequest = async (requestId: string) => {
    setActionId(requestId);
    const { error } = await supabase
      .from('chat_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to cancel request');
    } else {
      toast.success('Request cancelled');
      setSent(prev => prev.filter(r => r.id !== requestId));
    }
    setActionId(null);
  };

  // ─── Check if chat is expired ───
  const isChatExpired = (chat: ChatItem) => {
    if (chat.timer_stopped || !chat.expires_at) return false;
    return new Date(chat.expires_at).getTime() <= Date.now();
  };

  const activeChats = chats.filter(c => !isChatExpired(c));

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
        {incoming.length > 0 && (
          <div className="mb-6">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Received ({incoming.length})
            </h3>
            <div className="space-y-2">
              {incoming.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border"
                >
                  <div className="text-2xl">{req.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{req.alias}</span>
                    <p className="text-xs text-muted-foreground">wants to chat</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="default"
                      className="h-8 w-8"
                      disabled={actionId === req.id}
                      onClick={() => respondToRequest(req.id, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={actionId === req.id}
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

        {/* Sent Requests */}
        {sent.length > 0 && (
          <div className="mb-6">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <SendHorizontal className="h-4 w-4" />
              Sent ({sent.length})
            </h3>
            <div className="space-y-2">
              {sent.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border"
                >
                  <div className="text-2xl">{req.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{req.alias}</span>
                    <p className="text-xs text-muted-foreground">
                      {req.status === 'pending' ? 'Waiting for response...' : 'Declined'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {req.status === 'pending' && (
                      <Clock className="h-3.5 w-3.5 animate-pulse text-primary" />
                    )}
                    {req.status === 'declined' && (
                      <X className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={actionId === req.id}
                      onClick={() => cancelRequest(req.id)}
                      title="Cancel request"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood / Category chips */}
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
        ) : activeChats.length === 0 ? (
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
            {activeChats.map((chat) => {
              const hasTimer = !chat.timer_stopped && chat.expires_at;
              return (
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
                      {hasTimer && <Clock className="h-3 w-3 text-muted-foreground" />}
                      {chat.timer_stopped && (
                        <span className="text-[10px] text-primary font-medium">∞</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.last_message || 'No messages yet'}
                    </p>
                  </div>
                  <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
