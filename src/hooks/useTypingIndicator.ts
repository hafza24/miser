import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTypingIndicator = (chatId: string | undefined, userId: string | undefined) => {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<ReturnType<typeof supabase.channel>>();

  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase.channel(`typing-${chatId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id !== userId) {
          setIsOtherTyping(true);
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [chatId, userId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId },
    });
  }, [userId]);

  return { isOtherTyping, sendTyping };
};
