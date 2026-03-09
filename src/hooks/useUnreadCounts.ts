import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadCounts {
  [chatId: string]: number;
}

export const useUnreadCounts = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({});

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    // Get all chat participations with last_read_at
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

  // Listen for new messages in real-time
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-counts-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        fetchCounts();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCounts]);

  const totalUnread = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return { counts, totalUnread, refresh: fetchCounts };
};
