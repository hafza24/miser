import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus, Users, MessageCircle, Check, X,
  Inbox, SendHorizontal, Clock, Trash2, Sparkles, UserPlus, MoreVertical, ArrowUpRight,
  Bell, Crown, UsersRound, TrendingUp, Calendar, Search, LayoutDashboard
} from 'lucide-react';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useSubscription } from '@/hooks/useSubscription';
import { useNotifications } from '@/contexts/NotificationContext';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface ChatItem {
  id: string;
  mode: string;
  is_group: boolean;
  name: string | null;
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
  const { counts: unreadCounts, totalUnread, markChatAsRead } = useUnreadCounts();
  const { subscription, isActive, daysLeft } = useSubscription();
  const { unreadNotifCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const chatsOnly = location.pathname.startsWith('/app/chats');

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [convertChat, setConvertChat] = useState<ChatItem | null>(null);
  const [confirmChat, setConfirmChat] = useState<ChatItem | null>(null);
  const [convertName, setConvertName] = useState('');
  const [converting, setConverting] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'group'>('all');

  const handleConvertToGroup = async () => {
    if (!convertChat) return;
    setConverting(true);
    const { error } = await supabase.rpc('upgrade_chat_to_group' as any, {
      p_chat_id: convertChat.id,
      p_name: convertName.trim() || 'Group chat',
    });
    setConverting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Chat converted to a group');
    setConvertChat(null);
    setConvertName('');
    reload();
  };

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

    let chatIds = participations.map(p => p.chat_id);

    // Exclude Mood Room chats — they live in the dedicated Mood Rooms page.
    const { data: moodRoomChats } = await supabase
      .from('mood_rooms')
      .select('chat_id')
      .not('chat_id', 'is', null);
    const moodChatIds = new Set((moodRoomChats || []).map((r: any) => r.chat_id));
    chatIds = chatIds.filter(id => !moodChatIds.has(id));

    if (chatIds.length === 0) { setChats([]); return; }

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
          name: chat.name ?? null,
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
        if (chatId) navigate(`/app/chat/${chatId}`);
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
        navigate(`/app/chat/${chatId}`);
      } else {
        toast.info('No one available right now. Try again later!');
      }
    } catch (err: any) {
      toast.error('Something went wrong: ' + (err.message || 'Unknown error'));
    }
    setSurpriseLoading(false);
  };

  const activeChats = chats.filter(c => c.mode === mode && !isChatExpired(c));
  const directChats = activeChats.filter(c => !c.is_group);
  const groupChats = activeChats.filter(c => c.is_group);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={chatsOnly ? "Conversations" : (mode === 'light' ? 'Light Space' : 'Dark Space')}
          description={chatsOnly ? "Manage your 1:1 and group chats." : "Your activity and quick actions."}
          actions={
            !chatsOnly && (
              <div className="flex gap-2">
                <Button
                  onClick={handleSurpriseMe}
                  variant="outline"
                  size="sm"
                  disabled={surpriseLoading}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {surpriseLoading ? 'Searching…' : 'Surprise Me'}
                </Button>
                <Button
                  onClick={() => navigate('/app/browse')}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Find People
                </Button>
              </div>
            )
          }
        />

        {!chatsOnly && (
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-20 bg-primary/30 pointer-events-none" />
            <div className="relative">
              <h2 className="font-heading text-xl font-bold text-foreground">
                {mode === 'light' ? '🌞 Emotional Connections' : '🌑 18+ Exploration'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Safe, anonymous, and real human connection.
              </p>
            </div>
          </section>
        )}

        {/* Stats overview */}
        {!chatsOnly && (() => {

          const activeInMode = chats.filter(c => c.mode === mode && !isChatExpired(c));
          const directCount = activeInMode.filter(c => !c.is_group).length;
          const groupCount = activeInMode.filter(c => c.is_group).length;
          const notifCount = unreadNotifCount + invites.length + incoming.length;
          const planName = subscription?.plan?.name || 'Free';
          const dailyLimit = subscription?.plan?.daily_chat_limit ?? 3;
          const monthlyLimit = (subscription?.plan as any)?.monthly_chat_limit ?? 20;
          const now = new Date();
          const todayCount = chats.filter(c => new Date(c.created_at).toDateString() === now.toDateString()).length;
          const monthCount = chats.filter(c => {
            const d = new Date(c.created_at);
            return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
          }).length;
          const usagePct = dailyLimit > 0 ? Math.min(100, Math.round((todayCount / dailyLimit) * 100)) : 0;
          const monthPct = monthlyLimit > 0 ? Math.min(100, Math.round((monthCount / monthlyLimit) * 100)) : 0;

          const tiles = [
            {
              label: 'Notifications',
              value: notifCount,
              icon: Bell,
              hint: notifCount === 0 ? "You're all caught up" : 'Pending items',
              onClick: () => { /* dropdown lives in header */ },
            },
          ];

          return (
            <section aria-labelledby="stats-heading" className="space-y-2">
              <h2 id="stats-heading" className="sr-only">Overview</h2>

              {/* Notifications + Monthly usage in one row */}
              <div className="grid grid-cols-2 gap-2">
                {tiles.map((t) => (
                  <button
                    key={t.label}
                    onClick={t.onClick}
                    className="bento-tile p-3 text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.label}</span>
                      <t.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="mt-1 font-heading text-lg font-bold text-foreground leading-tight">{t.value}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{t.hint}</div>
                  </button>
                ))}

                {(() => {
                  const remaining = Math.max(0, monthlyLimit - monthCount);
                  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
                  const daysToReset = Math.max(1, Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  const exhausted = monthlyLimit > 0 && remaining === 0;
                  return (
                    <button
                      onClick={() => navigate('/subscription')}
                      className="bento-tile p-3 text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      aria-label="Monthly chat usage"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Monthly chats</span>
                        <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-heading text-lg font-bold text-foreground leading-tight">{monthCount}</span>
                        <span className="text-[11px] text-muted-foreground">/ {monthlyLimit > 0 ? monthlyLimit : '∞'}</span>
                      </div>
                      <div className={`text-[10px] truncate ${exhausted ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {monthlyLimit === 0
                          ? 'Unlimited'
                          : exhausted
                            ? `Resets in ${daysToReset}d`
                            : `${remaining} left · ${daysToReset}d`}
                      </div>
                      {monthlyLimit > 0 && (
                        <Progress value={monthPct} className="h-1 mt-1.5" />
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Plan card with all features */}
              {(() => {
                const plan = (subscription?.plan ?? {}) as any;
                const sceneLimit = plan.daily_scene_limit ?? 0;
                const groupLimit = plan.daily_group_limit ?? 0;
                const features = [
                  { label: 'Daily chats', value: `${todayCount}/${dailyLimit}` },
                  sceneLimit > 0 && { label: 'Scenes / day', value: String(sceneLimit) },
                  groupLimit > 0 && { label: 'Groups / day', value: String(groupLimit) },
                  plan.dark_mode_access && { label: 'Dark Mode', value: true },
                  plan.group_requests_access && { label: 'Group requests', value: true },
                  plan.auto_translate_access && { label: 'Auto-translate', value: true },
                  plan.presence_access && { label: 'Presence', value: true },
                ].filter(Boolean) as { label: string; value: string | boolean }[];
                return (
                  <button
                    onClick={() => navigate('/subscription')}
                    className="bento-tile w-full p-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    aria-label="View subscription plan"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Plan</span>
                        <span className="font-heading text-sm font-bold text-foreground truncate">{planName}</span>
                        {isActive && daysLeft > 0 && daysLeft < 3650 && (
                          <span className="text-[10px] text-muted-foreground">· {daysLeft}d left</span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-primary whitespace-nowrap">Manage →</span>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Today</span>
                        <span>{todayCount}/{dailyLimit}</span>
                      </div>
                      <Progress value={usagePct} className="h-1" />
                      {monthlyLimit > 0 && (
                        <>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 mb-0.5">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Month</span>
                            <span>{monthCount}/{monthlyLimit}</span>
                          </div>
                          <Progress value={monthPct} className="h-1" />
                        </>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {features.map((f) => {
                        const isBool = typeof f.value === 'boolean';
                        const enabled = isBool ? f.value : true;
                        return (
                          <div
                            key={f.label}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40 border border-border"
                          >
                            {isBool ? (
                              enabled ? (
                                <Check className="h-3 w-3 text-primary flex-shrink-0" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              )
                            ) : (
                              <span className="text-[10px] font-semibold text-foreground">{f.value as string}</span>
                            )}
                            <span className={`text-[10px] ${isBool && !enabled ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {f.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })()}
            </section>

          );

        })()}



        {/* Merged requests panel */}
        {!chatsOnly && (invites.length > 0 || incoming.length > 0 || sent.length > 0) && (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(invites.length > 0 || incoming.length > 0) && (
              <section className="bento-tile p-5" aria-labelledby="requests-heading">
                <h3 id="requests-heading" className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                  Requests ({invites.length + incoming.length})
                </h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border">
                      <div className="text-2xl">{inv.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground truncate block">{inv.alias} invited you</span>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <UserPlus className="h-3 w-3" /> to join {inv.group_name ? `“${inv.group_name}”` : 'a group chat'}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="default" className="h-8 w-8" disabled={actionId === inv.id} onClick={() => respondToInvite(inv.id, true)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" disabled={actionId === inv.id} onClick={() => respondToInvite(inv.id, false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {incoming.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border">
                      <div className="text-2xl">{req.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{req.alias}</span>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> wants to chat
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="default" className="h-8 w-8" disabled={actionId === req.id} onClick={() => respondToRequest(req.id, true)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" disabled={actionId === req.id} onClick={() => respondToRequest(req.id, false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {sent.length > 0 && (
              <section className="bento-tile p-5" aria-labelledby="sent-heading">
                <h3 id="sent-heading" className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <SendHorizontal className="h-4 w-4" aria-hidden="true" />
                  Sent ({sent.length})
                </h3>
                <div className="space-y-2">
                  {sent.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <div className="text-2xl">{req.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{req.alias}</span>
                        <p className="text-xs text-muted-foreground">
                          {req.status === 'pending' ? 'Waiting for response...' : 'Declined'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' && <Clock className="h-3.5 w-3.5 animate-pulse text-primary" />}
                        {req.status === 'declined' && <X className="h-3.5 w-3.5 text-destructive" />}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={actionId === req.id} onClick={() => cancelRequest(req.id)} title="Cancel request">
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







        {/* Chat lists — only on /chats route */}
        {chatsOnly && (loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="status" aria-label="Loading chats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : activeChats.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            description="Start connecting with people to see your chats here."
            action={{
              label: "Find People",
              onClick: () => navigate('/app/browse')
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex rounded-full bg-muted p-1" role="tablist" aria-label="Filter chats">
                {(['all','direct','group'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={chatFilter === k}
                    onClick={() => setChatFilter(k)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${chatFilter === k ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {k === 'all' ? 'All' : k === 'direct' ? 'Direct' : 'Groups'}
                  </button>
                ))}
              </div>
            </div>
            
            {(() => {
              const list = chatFilter === 'direct' ? directChats : chatFilter === 'group' ? groupChats : activeChats;
              if (list.length === 0) {
                return (
                  <EmptyState
                    icon={Search}
                    title="No results"
                    description={`You don't have any ${chatFilter === 'group' ? 'group ' : 'direct '}chats yet.`}
                  />
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {list.map((chat) => {
                    const unread = unreadCounts[chat.id] || 0;
                    const other = chat.participants[0] || { alias: 'Anonymous', emoji_avatar: '💫' };
                    const title = chat.is_group ? (chat.name || 'Unnamed Group') : other.alias;
                    const hasTimer = !chat.is_group && !chat.timer_stopped && chat.expires_at;

                    return (
                      <button
                        key={chat.id}
                        onClick={() => { markChatAsRead(chat.id); navigate(`/app/chat/${chat.id}`); }}
                        className="group relative flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/50 hover:bg-accent/30 transition-all text-left shadow-sm hover:shadow-md"
                      >
                        <div className="relative h-14 w-14 shrink-0 flex items-center justify-center bg-muted rounded-2xl text-3xl shadow-inner">
                          {chat.is_group ? '👥' : other.emoji_avatar}
                          {unread > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary border-2 border-card flex items-center justify-center text-[10px] text-primary-foreground font-bold">
                              {unread > 9 ? '+' : unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-foreground truncate">{title}</span>
                            {hasTimer && <Clock className="h-3 w-3 text-primary animate-pulse" />}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {chat.last_message || 'Start the conversation...'}
                          </p>
                        </div>
                        <MoreVertical className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ))}



        {/* Confirm before opening naming dialog */}
        <AlertDialog open={!!confirmChat} onOpenChange={(o) => { if (!o) setConfirmChat(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Convert this chat to a group?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmChat && (
                  <>
                    You're about to turn your chat with{' '}
                    <span className="font-medium text-foreground">
                      {confirmChat.participants.map(p => p.alias).join(', ') || 'Anonymous'}
                    </span>{' '}
                    into a group chat. This will move it to Group chats, stop the expiry timer, and let you invite more people. This can't be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const c = confirmChat;
                  setConfirmChat(null);
                  setConvertName('');
                  setConvertChat(c);
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Convert to group dialog */}
        <Dialog open={!!convertChat} onOpenChange={(o) => { if (!o) { setConvertChat(null); setConvertName(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert to group chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This chat will move to your Group chats. You can invite more people once it's a group.
              </p>
              <div>
                <label className="text-xs text-muted-foreground">Group name</label>
                <Input
                  value={convertName}
                  onChange={(e) => setConvertName(e.target.value)}
                  placeholder="e.g. Weekend crew"
                  maxLength={60}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setConvertChat(null); setConvertName(''); }} disabled={converting}>Cancel</Button>
              <Button onClick={handleConvertToGroup} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to group'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </AppLayout>
  );
};

export default DashboardPage;
