import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus, Users, MessageCircle, Check, X,
  Inbox, SendHorizontal, Clock, Trash2, Sparkles, UserPlus,
} from 'lucide-react';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
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

interface GroupInvite {
  id: string;
  chat_id: string;
  inviter_id: string;
  created_at: string;
  alias: string;
  emoji: string;
  group_name: string | null;
}

const DashboardPage = () => {
  const { user } = useAuth();
  const { mode } = useMode();
  const { counts: unreadCounts, markChatAsRead } = useUnreadCounts();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([loadChats(), loadIncoming(), loadSent(), loadInvites()]);
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_invites',
        filter: `invitee_id=eq.${user.id}`,
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
          const { data: profiles } = await supabase.rpc('get_public_profile_by_ids', { user_ids: otherIds });
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
    const { data: profiles } = await supabase.rpc('get_public_profile_by_ids', { user_ids: ids });

    setIncoming(data.map(r => {
      const p = profiles?.find(p => p.user_id === r.sender_id);
      return { ...r, alias: p?.alias || 'Anonymous', emoji: p?.emoji_avatar || '💫' };
    }));
  };

  // ─── Load sent requests ───
  const loadSent = async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('chat_requests')
      .select('id, receiver_id, status, created_at')
      .eq('sender_id', user.id)
      .in('status', ['pending', 'declined'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (!data?.length) { setSent([]); return; }

    const ids = data.map(r => r.receiver_id);
    const { data: profiles } = await supabase.rpc('get_public_profile_by_ids', { user_ids: ids });

    setSent(data.map(r => {
      const p = profiles?.find(p => p.user_id === r.receiver_id);
      return { ...r, alias: p?.alias || 'Anonymous', emoji: p?.emoji_avatar || '💫' };
    }));
  };

  // ─── Load pending group invites ───
  const loadInvites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_invites')
      .select('id, chat_id, inviter_id, created_at')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!data?.length) { setInvites([]); return; }

    const inviterIds = [...new Set(data.map(r => r.inviter_id))];
    const chatIds = [...new Set(data.map(r => r.chat_id))];
    const [{ data: profiles }, { data: chatRows }] = await Promise.all([
      supabase.rpc('get_public_profile_by_ids', { user_ids: inviterIds }),
      supabase.from('chats').select('id, name').in('id', chatIds),
    ]);
    const chatMap = new Map((chatRows ?? []).map((c: any) => [c.id, c.name as string | null]));

    setInvites(data.map(r => {
      const p = profiles?.find((p: any) => p.user_id === r.inviter_id);
      return {
        ...r,
        alias: p?.alias || 'Anonymous',
        emoji: p?.emoji_avatar || '💫',
        group_name: chatMap.get(r.chat_id) ?? null,
      };
    }));
  };

  // ─── Accept / Decline group invite ───
  const respondToInvite = async (inviteId: string, accept: boolean) => {
    setActionId(inviteId);
    try {
      const { data: chatId, error } = await supabase.rpc('respond_chat_invite', {
        p_invite_id: inviteId,
        p_accept: accept,
      });
      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      if (accept) {
        toast.success('Joined group!');
        await loadChats();
        if (chatId) navigate(`/chat/${chatId}`);
      } else {
        toast.success('Invite declined.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond to invite');
    }
    setActionId(null);
  };



  // ─── Accept / Decline incoming ───
  const respondToRequest = async (requestId: string, accept: boolean) => {
    if (!user) return;
    setActionId(requestId);

    try {
      if (accept) {
        const { data: chatId, error: acceptError } = await supabase.rpc('accept_chat_request', {
          p_request_id: requestId,
          p_mode: mode as 'light' | 'dark',
        });

        if (acceptError) throw acceptError;

        toast.success('Request accepted! Chat created.');
        setIncoming(prev => prev.filter(r => r.id !== requestId));

        if (chatId) {
          await loadChats();
        }
      } else {
        const { error } = await supabase
          .from('chat_requests')
          .update({ status: 'declined' })
          .eq('id', requestId);

        if (error) throw error;

        toast.success('Request declined.');
        setIncoming(prev => prev.filter(r => r.id !== requestId));
      }
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

  // ─── Surprise Me (random chat) ───
  const handleSurpriseMe = async () => {
    setSurpriseLoading(true);
    try {
      const { data: chatId, error } = await supabase.rpc('start_random_chat', {
        p_mode: mode as 'light' | 'dark',
      });
      if (error) throw error;
      if (chatId) {
        toast.success('Matched! Opening chat...');
        navigate(`/chat/${chatId}`);
      } else {
        toast.info('No one available right now. Try again later!');
      }
    } catch (err: any) {
      toast.error('Something went wrong: ' + (err.message || 'Unknown error'));
    }
    setSurpriseLoading(false);
  };

  const activeChats = chats.filter(c => c.mode === mode && !isChatExpired(c));

  return (
    <AppLayout>
      <div className="p-4 md:p-0 space-y-6">
        {/* Hero header */}
        <section
          className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card p-5 sm:p-7"
          aria-labelledby="dashboard-title"
        >
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-40 gradient-hero pointer-events-none"
          />
          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {mode === 'light' ? 'Light Space' : 'Dark Space'}
              </div>
              <h1 id="dashboard-title" className="mt-1 font-heading text-2xl sm:text-3xl font-bold text-foreground text-balance">
                {mode === 'light' ? '🌞 Emotional connections' : '🌑 18+ connections'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your chats, invites, and requests — all in one place.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={handleSurpriseMe}
                variant="outline"
                size="sm"
                className="gap-2 flex-1 sm:flex-initial min-h-11 sm:min-h-9"
                disabled={surpriseLoading}
                aria-label="Match with a random person"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {surpriseLoading ? 'Searching…' : 'Surprise Me'}
              </Button>
              <Button
                onClick={() => navigate('/browse')}
                size="sm"
                className="gap-2 flex-1 sm:flex-initial min-h-11 sm:min-h-9"
                aria-label="Browse people"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Find People
              </Button>
            </div>
          </div>
        </section>

        {/* Bento requests grid */}
        {(invites.length > 0 || incoming.length > 0 || sent.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">


        {/* Group Invites */}
        {invites.length > 0 && (
          <section className="bento-tile p-5" aria-labelledby="invites-heading">

            <h3 id="invites-heading" className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />

              Group Invites ({invites.length})
            </h3>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border"
                >
                  <div className="text-2xl">{inv.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block">
                      {inv.alias} invited you
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      to join {inv.group_name ? `“${inv.group_name}”` : 'a group chat'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="default"
                      className="h-8 w-8"
                      disabled={actionId === inv.id}
                      onClick={() => respondToInvite(inv.id, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={actionId === inv.id}
                      onClick={() => respondToInvite(inv.id, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Incoming Requests */}
        {incoming.length > 0 && (
          <section className="bento-tile p-5" aria-labelledby="incoming-heading">
            <h3 id="incoming-heading" className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Inbox className="h-4 w-4" aria-hidden="true" />

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
          </section>
        )}

        {/* Sent Requests */}
        {sent.length > 0 && (
          <section className="bento-tile p-5" aria-labelledby="sent-heading">
            <h3 id="sent-heading" className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />

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
          </section>
        )}
          </div>
        )}



        {/* Mood / Category chips */}
        {mode === 'light' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { label: '💛 Emotional Support', interest: 'Emotional Support' },
              { label: '🤝 Friendship', interest: 'Friendship' },
              { label: '💕 Cute Love', interest: 'Cute Love' },
            ].map(mood => (
              <button
                key={mood.interest}
                onClick={() => navigate(`/browse?interest=${encodeURIComponent(mood.interest)}`)}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all hover:scale-[1.03] active:scale-95"
              >
                {mood.label}
              </button>
            ))}
          </div>
        )}
        {mode === 'dark' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { label: '💋 Flirting', interest: 'Flirting' },
              { label: '🔥 Passionate Romance', interest: 'Passionate Romance' },
              { label: '✨ Fantasy Roleplay', interest: 'Fantasy Roleplay' },
            ].map(cat => (
              <button
                key={cat.interest}
                onClick={() => navigate(`/browse?interest=${encodeURIComponent(cat.interest)}`)}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all hover:scale-[1.03] active:scale-95 neon-glow"
              >
                {cat.label}
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
              const unread = unreadCounts[chat.id] || 0;
              return (
                <button
                  key={chat.id}
                  onClick={() => { markChatAsRead(chat.id); navigate(`/chat/${chat.id}`); }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted transition-colors text-left shadow-card"
                >
                  <div className="text-2xl">
                    {chat.participants[0]?.emoji_avatar || '💬'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${unread > 0 ? 'text-foreground font-semibold' : 'text-foreground'}`}>
                        {chat.participants.map(p => p.alias).join(', ') || 'Anonymous'}
                      </span>
                      {chat.is_group && <Users className="h-3 w-3 text-muted-foreground" />}
                      {hasTimer && <Clock className="h-3 w-3 text-muted-foreground" />}
                      {chat.timer_stopped && (
                        <span className="text-[10px] text-primary font-medium">∞</span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {chat.last_message || 'No messages yet'}
                    </p>
                  </div>
                  {unread > 0 ? (
                    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : (
                    <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
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
