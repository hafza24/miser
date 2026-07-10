import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadCounts {
  [chatId: string]: number;
}

// Simple notification sound using Web Audio API
export const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
};

export const showDesktopNotification = (
  title: string,
  body: string,
  opts: { tag?: string; url?: string; force?: boolean } = {}
) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  // Skip if the tab is visible AND focused, unless forced
  if (!opts.force && document.visibilityState === 'visible' && document.hasFocus()) return;

  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: opts.tag || 'general',
    data: { url: opts.url || '/' },
  };

  // Prefer service worker registration (required for Android/PWA background notifications)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.showNotification(title, options).catch(() => {
          try { new Notification(title, options); } catch {}
        });
      } else {
        try { new Notification(title, options); } catch {}
      }
    }).catch(() => {
      try { new Notification(title, options); } catch {}
    });
  } else {
    try { new Notification(title, options); } catch {}
  }
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const useUnreadCounts = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({});
  const prevTotalRef = useRef(0);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id, last_read_at')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setCounts({});
      return;
    }

    // Exclude Mood Room chats from unread badge
    const { data: moodRoomChats } = await supabase
      .from('mood_rooms')
      .select('chat_id')
      .not('chat_id', 'is', null);
    const moodChatIds = new Set((moodRoomChats || []).map((r: any) => r.chat_id));
    const filtered = participations.filter(p => !moodChatIds.has(p.chat_id));
    if (!filtered.length) {
      setCounts({});
      return;
    }

    const newCounts: UnreadCounts = {};

    await Promise.all(
      filtered.map(async (p) => {
        let query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('chat_id', p.chat_id)
          .neq('sender_id', user.id);

        if (p.last_read_at) {
          query = query.gt('created_at', p.last_read_at);
        }

        const { count } = await query;
        if (count && count > 0) {
          newCounts[p.chat_id] = count;
        }
      })
    );

    setCounts(newCounts);
  }, [user]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Listen for new messages in real-time
  useEffect(() => {
    if (!user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `unread-counts-${user.id}`;

    // Remove any existing channel with this name first
    const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          // Sound/desktop notification is centralized in NotificationContext to avoid duplicates.
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchCounts();
          }, 1000);
        }
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const totalUnread = Object.values(counts).reduce((sum, c) => sum + c, 0);

  // Track previous total for comparison
  useEffect(() => {
    prevTotalRef.current = totalUnread;
  }, [totalUnread]);

  const markChatAsRead = useCallback(async (chatId: string) => {
    if (!user) return;
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', user.id);
    // Optimistically clear count
    setCounts(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, [user]);

  return { counts, totalUnread, refresh: fetchCounts, markChatAsRead };
};
