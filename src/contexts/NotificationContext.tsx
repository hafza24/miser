import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound, showDesktopNotification } from '@/hooks/useUnreadCounts';

export interface NotificationItem {
  id: string;
  type:
    | 'chat_request'
    | 'new_message'
    | 'expiry_alert'
    | 'subscription_expiring'
    | 'subscription_expired'
    | 'payment_pending'
    | 'group_invite'
    | 'mention'
    | 'admin_pending_subscription'
    | 'admin_pending_payment_request';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  meta?: { chatId?: string; requestId?: string; inviteId?: string; adminRoute?: string; messageId?: string; mentionRowId?: string };
}


interface NotificationContextType {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  setDesktopEnabled: (v: boolean) => void;
  notifications: NotificationItem[];
  unreadNotifCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Per-user persistent read-state to prevent notifications reappearing after login
const readKey = (userId: string) => `notif_read_v2_${userId}`;
const loadReadIds = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(readKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as Array<[string, number]>;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // expire after 7d
    return new Set(arr.filter(([, ts]) => ts > cutoff).map(([id]) => id));
  } catch {
    return new Set();
  }
};
const persistReadIds = (userId: string, ids: Set<string>) => {
  try {
    const now = Date.now();
    const arr = Array.from(ids).map((id) => [id, now] as [string, number]);
    localStorage.setItem(readKey(userId), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

const getCurrentChatId = (): string | null => {
  const m = window.location.pathname.match(/^\/chat\/([^/?#]+)/);
  return m ? m[1] : null;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const stored = localStorage.getItem('notif_sound');
    return stored !== null ? stored === 'true' : true;
  });
  const [desktopEnabled, setDesktopEnabledState] = useState(() => {
    const stored = localStorage.getItem('notif_desktop');
    return stored !== null ? stored === 'true' : false;
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const readIdsRef = useRef<Set<string>>(new Set());
  const lastEventKeyRef = useRef<Set<string>>(new Set()); // dedup realtime events
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted read state + admin role when user changes
  useEffect(() => {
    if (!user) {
      readIdsRef.current = new Set();
      setNotifications([]);
      setMutedIds(new Set());
      setIsAdmin(false);
      return;
    }
    readIdsRef.current = loadReadIds(user.id);
    supabase.from('muted_users').select('muted_id').eq('muter_id', user.id).then(({ data }) => {
      setMutedIds(new Set((data ?? []).map((r: any) => r.muted_id)));
    });
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);


  // Pref flags (default true if profile not yet loaded)
  const prefMessages = profile?.notify_messages ?? true;
  const prefRequests = profile?.notify_requests ?? true;
  const prefExpiry   = profile?.notify_expiry   ?? true;
  const prefGroupInvites = profile?.notify_group_invites_pref ?? true;
  const prefMatches = profile?.notify_matches ?? true;
  const prefMentions = profile?.notify_mentions ?? true;


  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    localStorage.setItem('notif_sound', String(v));
  };

  const setDesktopEnabled = async (v: boolean) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }
    setDesktopEnabledState(v);
    localStorage.setItem('notif_desktop', String(v));
  };

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const items: NotificationItem[] = [];

    // 1) Pending incoming chat requests
    const { data: requests } = await supabase
      .from('chat_requests')
      .select('id, sender_id, created_at, status')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(20);

    const profileCache: Record<string, { alias?: string; emoji_avatar?: string }> = {};
    const idsToFetch = new Set<string>();
    requests?.forEach((r) => idsToFetch.add(r.sender_id));

    // 1b) Pending group invites
    const { data: invites } = await supabase
      .from('chat_invites')
      .select('id, chat_id, inviter_id, created_at')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(20);
    invites?.forEach((i) => idsToFetch.add(i.inviter_id));
    const inviteChatIds = [...new Set((invites ?? []).map(i => i.chat_id))];
    let inviteChatNameMap = new Map<string, string | null>();
    if (inviteChatIds.length) {
      const { data: inviteChats } = await supabase
        .from('chats')
        .select('id, name')
        .in('id', inviteChatIds);
      inviteChatNameMap = new Map((inviteChats ?? []).map((c: any) => [c.id, c.name as string | null]));
    }


    // 2) Unread messages — one notification per chat
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id, last_read_at')
      .eq('user_id', user.id);

    const chatIds = participations?.map((p) => p.chat_id) ?? [];
    const lastReadMap = new Map<string, string | null>(
      (participations ?? []).map((p) => [p.chat_id, p.last_read_at])
    );

    type MsgRow = { id: string; chat_id: string; sender_id: string; content: string; created_at: string };
    const unreadByChat = new Map<string, MsgRow[]>();

    if (chatIds.length) {
      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('id, chat_id, sender_id, content, created_at')
        .in('chat_id', chatIds)
        .neq('sender_id', user.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(200);

      (recentMsgs ?? []).forEach((m) => {
        const lr = lastReadMap.get(m.chat_id);
        if (lr && new Date(m.created_at) <= new Date(lr)) return;
        const arr = unreadByChat.get(m.chat_id) ?? [];
        arr.push(m as MsgRow);
        unreadByChat.set(m.chat_id, arr);
        idsToFetch.add(m.sender_id);
      });
    }

    if (idsToFetch.size) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar')
        .in('user_id', Array.from(idsToFetch));
      profiles?.forEach((p) => {
        profileCache[p.user_id] = { alias: p.alias, emoji_avatar: p.emoji_avatar };
      });
    }

    if (prefRequests) {
      requests?.forEach((req) => {
        if (mutedIds.has(req.sender_id)) return;
        const p = profileCache[req.sender_id];
        items.push({
          id: `req-${req.id}`,
          type: 'chat_request',
          title: 'New Chat Request',
          message: `${p?.emoji_avatar || '💫'} ${p?.alias || 'Someone'} wants to chat`,
          timestamp: req.created_at,
          read: false,
          meta: { requestId: req.id },
        });
      });
    }

    if (prefGroupInvites) {
      invites?.forEach((inv) => {
        if (mutedIds.has(inv.inviter_id)) return;
        const p = profileCache[inv.inviter_id];
        const name = inviteChatNameMap.get(inv.chat_id);
        items.push({
          id: `inv-${inv.id}`,
          type: 'group_invite',
          title: 'Group Invite',
          message: `${p?.emoji_avatar || '👥'} ${p?.alias || 'Someone'} invited you to ${name ? `“${name}”` : 'a group chat'}`,
          timestamp: inv.created_at,
          read: false,
          meta: { inviteId: inv.id, chatId: inv.chat_id },
        });
      });
    }



    if (prefMessages) {
      unreadByChat.forEach((msgs, chatId) => {
        const latest = msgs[0];
        if (mutedIds.has(latest.sender_id)) return;
        const p = profileCache[latest.sender_id];
        const count = msgs.length;
        const preview = (latest.content || '').slice(0, 80) || 'New message';
        items.push({
          id: `msg-${chatId}-${latest.id}`,
          type: 'new_message',
          title: count > 1
            ? `${p?.alias || 'Someone'} • ${count} new messages`
            : `${p?.emoji_avatar || '💬'} ${p?.alias || 'Someone'}`,
          message: preview,
          timestamp: latest.created_at,
          read: false,
          meta: { chatId },
        });
      });
    }


    // 3) Chats expiring within 2 hours
    if (prefExpiry && chatIds.length) {
      const soonExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const { data: expiringChats } = await supabase
        .from('chats')
        .select('id, expires_at')
        .in('id', chatIds)
        .eq('timer_stopped', false)
        .not('expires_at', 'is', null)
        .gt('expires_at', now)
        .lte('expires_at', soonExpiry)
        .order('expires_at', { ascending: true })
        .limit(10);

      expiringChats?.forEach((chat) => {
        const minutesLeft = Math.round((new Date(chat.expires_at!).getTime() - Date.now()) / 60000);
        items.push({
          id: `exp-${chat.id}`,
          type: 'expiry_alert',
          title: 'Chat Expiring Soon',
          message: minutesLeft <= 60 ? `A chat expires in ${minutesLeft} min` : `A chat expires in ~${Math.round(minutesLeft / 60)}h`,
          timestamp: chat.expires_at!,
          read: false,
          meta: { chatId: chat.id },
        });
      });
    }


    // 4) Subscription notifications (own account)
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, status, expiry_date, plan_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const sub = subs?.[0] as any;
    if (sub) {
      if (sub.status === 'pending') {
        items.push({
          id: `sub-pending-${sub.id}`,
          type: 'payment_pending',
          title: 'Payment Pending Review',
          message: 'Your payment is being reviewed by our team. Features unlock once approved.',
          // Stable timestamp so this doesn't jump to the top on every refresh
          timestamp: sub.created_at || new Date().toISOString(),
          read: false,
        });
      } else if (sub.status === 'active' && sub.expiry_date) {
        const daysLeft = Math.ceil((new Date(sub.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 3 && daysLeft > 0) {
          items.push({
            // Include daysLeft so the reminder re-appears once the countdown drops
            id: `sub-expiring-${sub.id}-${daysLeft}`,
            type: 'subscription_expiring',
            title: 'Subscription Expiring Soon',
            message: `Your subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Renew to keep access.`,
            timestamp: sub.expiry_date,
            read: false,
          });
        }
      } else if (sub.status === 'expired') {
        items.push({
          id: `sub-expired-${sub.id}`,
          type: 'subscription_expired',
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Renew to regain premium access.',
          timestamp: sub.expiry_date || new Date().toISOString(),
          read: false,
        });
      }
    }

    // 5) Admin queue notifications — pending subscriptions & payment requests
    if (isAdmin) {
      const [pendingSubsRes, pendingPayReqRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, created_at', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('payment_requests')
          .select('id, created_at', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const subCount = pendingSubsRes.count ?? 0;
      if (subCount > 0) {
        const latest = pendingSubsRes.data?.[0] as any;
        items.push({
          id: `admin-sub-pending-${latest?.id ?? 'q'}`,
          type: 'admin_pending_subscription',
          title: `${subCount} Subscription${subCount > 1 ? 's' : ''} Awaiting Review`,
          message: 'Tap to review pending subscription payments.',
          timestamp: latest?.created_at || new Date().toISOString(),
          read: false,
          meta: { adminRoute: '/admin/subscriptions' },
        });
      }

      const payCount = pendingPayReqRes.count ?? 0;
      if (payCount > 0) {
        const latest = pendingPayReqRes.data?.[0] as any;
        items.push({
          id: `admin-payreq-pending-${latest?.id ?? 'q'}`,
          type: 'admin_pending_payment_request',
          title: `${payCount} Payment Request${payCount > 1 ? 's' : ''} Awaiting Review`,
          message: 'Users have submitted payment proof for unlock. Tap to review.',
          timestamp: latest?.created_at || new Date().toISOString(),
          read: false,
          meta: { adminRoute: '/admin/payments' },
        });
      }
    }

    // 6) Mention notifications (server-enforced by notify_mentions)
    if (prefMentions) {
      const { data: mentions } = await supabase
        .from('mention_notifications')
        .select('id, chat_id, message_id, mentioner_id, created_at, read_at')
        .eq('user_id', user.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);

      const mentionerIds = new Set<string>((mentions ?? []).map((m: any) => m.mentioner_id));
      const missing = Array.from(mentionerIds).filter((id) => !profileCache[id]);
      if (missing.length) {
        const { data: mprofiles } = await supabase
          .from('profiles')
          .select('user_id, alias, emoji_avatar')
          .in('user_id', missing);
        mprofiles?.forEach((p: any) => {
          profileCache[p.user_id] = { alias: p.alias, emoji_avatar: p.emoji_avatar };
        });
      }

      const msgIds = (mentions ?? []).map((m: any) => m.message_id);
      let msgContentMap = new Map<string, string>();
      if (msgIds.length) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, content')
          .in('id', msgIds);
        msgContentMap = new Map((msgs ?? []).map((m: any) => [m.id, (m.content || '').slice(0, 120)]));
      }

      (mentions ?? []).forEach((m: any) => {
        if (mutedIds.has(m.mentioner_id)) return;
        const p = profileCache[m.mentioner_id];
        const preview = msgContentMap.get(m.message_id) || 'mentioned you';
        items.push({
          id: `mention-${m.id}`,
          type: 'mention',
          title: `${p?.emoji_avatar || '@'} ${p?.alias || 'Someone'} mentioned you`,
          message: preview,
          timestamp: m.created_at,
          read: !!m.read_at,
          meta: { chatId: m.chat_id, messageId: m.message_id, mentionRowId: m.id },
        });
      });
    }


    // Apply persisted read state + dedupe by id, newest first
    const seen = new Set<string>();
    const merged = items
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .map((it) => ({ ...it, read: it.read || readIdsRef.current.has(it.id) }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setNotifications(merged);
  }, [user, prefMessages, prefRequests, prefExpiry, prefGroupInvites, prefMentions, mutedIds, isAdmin]);

  // Debounced refresh to coalesce bursts of realtime events
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshNotifications();
    }, 400);
  }, [refreshNotifications]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Realtime: chat_requests + messages (dedup by event key)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-ctx-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        const key = `req:${(payload.new as any)?.id}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, () => scheduleRefresh())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (!msg || msg.sender_id === user.id) return;
        if (mutedIds.has(msg.sender_id)) return;
        const key = `msg:${msg.id}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);

        const currentChatId = getCurrentChatId();
        const isOnChat = currentChatId === msg.chat_id && document.hasFocus();
        if (!isOnChat && prefMessages) {
          if (soundEnabled) playNotificationSound();
          if (desktopEnabled) showDesktopNotification('New Message', (msg.content || '').slice(0, 100));
        }
        scheduleRefresh();
      })

      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, () => scheduleRefresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_invites',
        filter: `invitee_id=eq.${user.id}`,
      }, (payload) => {
        const inv = (payload.new ?? payload.old) as any;
        const key = `inv:${inv?.id}:${payload.eventType}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);
        if (payload.eventType === 'INSERT' && prefGroupInvites) {
          if (soundEnabled) playNotificationSound();
          if (desktopEnabled) showDesktopNotification('Group Invite', 'You were invited to a group chat');
        }
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        const key = `match:${row?.id}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);
        if (prefMatches) {
          if (soundEnabled) playNotificationSound();
          if (desktopEnabled) showDesktopNotification('New match', 'A compatible person just appeared. Say hi!');
        }
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mention_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        const key = `mention:${row?.id}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);
        if (prefMentions) {
          if (soundEnabled) playNotificationSound();
          if (desktopEnabled) showDesktopNotification('You were mentioned', 'Someone mentioned you in a chat');
        }
        scheduleRefresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [user?.id, scheduleRefresh, soundEnabled, desktopEnabled, mutedIds, prefMessages, prefGroupInvites, prefMatches, prefMentions]);

  // Admin-only realtime: pending subscriptions & payment requests
  useEffect(() => {
    if (!user || !isAdmin) return;
    const channel = supabase
      .channel(`notif-admin-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (soundEnabled) playNotificationSound();
          if (desktopEnabled) showDesktopNotification('New payment request', 'A user submitted payment proof for review.');
        }
        scheduleRefresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAdmin, scheduleRefresh, soundEnabled, desktopEnabled]);


  // Refresh expiry alerts every 5 min
  useEffect(() => {
    const interval = setInterval(refreshNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const markAllRead = () => {
    if (!user) return;
    notifications.forEach((n) => readIdsRef.current.add(n.id));
    persistReadIds(user.id, readIdsRef.current);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    if (!user) return;
    readIdsRef.current.add(id);
    persistReadIds(user.id, readIdsRef.current);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      soundEnabled, desktopEnabled,
      setSoundEnabled, setDesktopEnabled,
      notifications, unreadNotifCount,
      markAllRead, markRead, refreshNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
