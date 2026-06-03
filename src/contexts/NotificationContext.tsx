import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound, showDesktopNotification } from '@/hooks/useUnreadCounts';

export interface NotificationItem {
  id: string;
  type: 'chat_request' | 'new_message' | 'expiry_alert' | 'subscription_expiring' | 'subscription_expired' | 'payment_pending';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  meta?: { chatId?: string; requestId?: string };
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
  const readIdsRef = useRef<Set<string>>(new Set());
  const lastEventKeyRef = useRef<Set<string>>(new Set()); // dedup realtime events
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted read state when user changes
  useEffect(() => {
    if (!user) {
      readIdsRef.current = new Set();
      setNotifications([]);
      setMutedIds(new Set());
      return;
    }
    readIdsRef.current = loadReadIds(user.id);
    // Load mute list
    supabase.from('muted_users').select('muted_id').eq('muter_id', user.id).then(({ data }) => {
      setMutedIds(new Set((data ?? []).map((r: any) => r.muted_id)));
    });
  }, [user?.id]);

  // Pref flags (default true if profile not yet loaded)
  const prefMessages = profile?.notify_messages ?? true;
  const prefRequests = profile?.notify_requests ?? true;
  const prefExpiry   = profile?.notify_expiry   ?? true;


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

    requests?.forEach((req) => {
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

    unreadByChat.forEach((msgs, chatId) => {
      const latest = msgs[0];
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

    // 3) Chats expiring within 2 hours
    if (chatIds.length) {
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

    // 4) Subscription notifications
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, status, expiry_date, plan_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const sub = subs?.[0] as any;
    if (sub) {
      if (sub.status === 'pending') {
        items.push({
          id: `sub-pending-${sub.id}`,
          type: 'payment_pending',
          title: 'Payment Pending',
          message: 'Your payment is being reviewed. Features unlock once approved.',
          timestamp: new Date().toISOString(),
          read: false,
        });
      } else if (sub.status === 'active' && sub.expiry_date) {
        const daysLeft = Math.ceil((new Date(sub.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 3 && daysLeft > 0) {
          items.push({
            id: `sub-expiring-${sub.id}`,
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

    // Apply persisted read state + dedupe by id, newest first
    const seen = new Set<string>();
    const merged = items
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .map((it) => ({ ...it, read: readIdsRef.current.has(it.id) }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setNotifications(merged);
  }, [user]);

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
        const key = `msg:${msg.id}`;
        if (lastEventKeyRef.current.has(key)) return;
        lastEventKeyRef.current.add(key);

        // Skip alerting if the user is currently viewing that chat
        const currentChatId = getCurrentChatId();
        const isOnChat = currentChatId === msg.chat_id && document.hasFocus();
        if (!isOnChat) {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [user?.id, scheduleRefresh, soundEnabled, desktopEnabled]);

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
