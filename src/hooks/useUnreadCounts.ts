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

export const showDesktopNotification = (title: string, body: string) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // Don't show if app is focused
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'new-message', // Replaces previous notification
    });
  } catch {
    // Notification not supported
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

    const newCounts: UnreadCounts = {};

    await Promise.all(
      participations.map(async (p) => {
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

  // Listen for new messages in real-time — only refetch on new messages, not participant updates
  useEffect(() => {
    if (!user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchCounts();
      }, 1000);
    };

    const channel = supabase
      .channel(`unread-counts-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          const soundPref = localStorage.getItem('notif_sound');
          const desktopPref = localStorage.getItem('notif_desktop');
          if (soundPref !== 'false') playNotificationSound();
          if (desktopPref === 'true') showDesktopNotification('New Message', msg.content?.slice(0, 100) || 'You have a new message');
          debouncedFetch();
        }
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchCounts]);

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
