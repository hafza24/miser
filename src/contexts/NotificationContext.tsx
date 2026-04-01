import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationItem {
  id: string;
  type: 'chat_request' | 'expiry_alert' | 'subscription_expiring' | 'subscription_expired' | 'payment_pending';
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
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const stored = localStorage.getItem('notif_sound');
    return stored !== null ? stored === 'true' : true;
  });
  const [desktopEnabled, setDesktopEnabledState] = useState(() => {
    const stored = localStorage.getItem('notif_desktop');
    return stored !== null ? stored === 'true' : false;
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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
    if (!user) { setNotifications([]); return; }
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const items: NotificationItem[] = [];

    // Fetch pending incoming chat requests
    const { data: requests } = await supabase
      .from('chat_requests')
      .select('id, sender_id, created_at, status')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(20);

    if (requests?.length) {
      const senderIds = requests.map(r => r.sender_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar')
        .in('user_id', senderIds);

      for (const req of requests) {
        const p = profiles?.find(pr => pr.user_id === req.sender_id);
        items.push({
          id: `req-${req.id}`,
          type: 'chat_request',
          title: 'New Chat Request',
          message: `${p?.emoji_avatar || '💫'} ${p?.alias || 'Someone'} wants to chat`,
          timestamp: req.created_at,
          read: false,
          meta: { requestId: req.id },
        });
      }
    }

    // Fetch chats expiring within 2 hours
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (participations?.length) {
      const chatIds = participations.map(p => p.chat_id);
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

      if (expiringChats?.length) {
        for (const chat of expiringChats) {
          const expiresAt = new Date(chat.expires_at!);
          const minutesLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);
          items.push({
            id: `exp-${chat.id}`,
            type: 'expiry_alert',
            title: 'Chat Expiring Soon',
            message: minutesLeft <= 60
              ? `A chat expires in ${minutesLeft} min`
              : `A chat expires in ~${Math.round(minutesLeft / 60)}h`,
            timestamp: chat.expires_at!,
            read: false,
            meta: { chatId: chat.id },
          });
        }
      }
    }

    // Subscription notifications
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, status, expiry_date, plan_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (subs?.length) {
      const sub = subs[0] as any;
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

    // Merge with existing read status
    setNotifications(prev => {
      const readIds = new Set(prev.filter(n => n.read).map(n => n.id));
      return items.map(it => ({ ...it, read: readIds.has(it.id) }));
    });
  }, [user]);

  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  // Realtime: refresh on new chat_requests
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-ctx-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, () => refreshNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refreshNotifications]);

  // Refresh expiry alerts every 5 min
  useEffect(() => {
    const interval = setInterval(refreshNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      soundEnabled, desktopEnabled,
      setSoundEnabled, setDesktopEnabled,
      notifications, unreadNotifCount,
      markAllRead, refreshNotifications,
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
