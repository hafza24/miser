import React, { useState, useEffect } from 'react';
import { Clock, StopCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimerStopRequest {
  id: string;
  chat_id: string;
  sender_id: string;
  status: string;
}

interface ChatTimerProps {
  chatId: string;
  expiresAt: string | null;
  timerStopped: boolean;
  currentUserId: string;
  chatMode?: 'light' | 'dark';
}

const ChatTimer = ({ chatId, expiresAt, timerStopped, currentUserId, chatMode = 'light' }: ChatTimerProps) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [stopRequest, setStopRequest] = useState<TimerStopRequest | null>(null);
  const [sending, setSending] = useState(false);

  // Load existing pending stop request
  useEffect(() => {
    const loadStopRequest = async () => {
      const { data } = await supabase
        .from('timer_stop_requests')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .limit(1);
      if (data && data.length > 0) setStopRequest(data[0] as TimerStopRequest);
    };
    loadStopRequest();

    // Realtime for stop requests
    const channel = supabase
      .channel(`timer-${chatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timer_stop_requests',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setStopRequest(payload.new as TimerStopRequest);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TimerStopRequest;
          if (updated.status !== 'pending') {
            setStopRequest(null);
            if (updated.status === 'accepted') {
              toast.success('Timer stopped! Chat is now permanent.');
            }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  // Countdown timer
  useEffect(() => {
    if (timerStopped || !expiresAt) {
      setTimeLeft('');
      return;
    }

    const update = () => {
      const now = Date.now();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, timerStopped]);

  const sendStopRequest = async () => {
    setSending(true);
    const { error } = await supabase.from('timer_stop_requests').insert({
      chat_id: chatId,
      sender_id: currentUserId,
    } as any);
    setSending(false);
    if (error) {
      toast.error('Failed to send request');
    } else {
      toast.success('Timer stop request sent!');
    }
  };

  const respondToStopRequest = async (accept: boolean) => {
    if (!stopRequest) return;
    setSending(true);

    if (accept) {
      // Update chat to stop timer
      await supabase
        .from('chats')
        .update({ timer_stopped: true } as any)
        .eq('id', chatId);
    }

    await supabase
      .from('timer_stop_requests')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', stopRequest.id);

    setSending(false);
    setStopRequest(null);
    toast.success(accept ? 'Timer stopped!' : 'Request declined.');
  };

  if (timerStopped) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
        <Check className="h-3 w-3 text-primary" />
        <span>Permanent chat</span>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-1 rounded-full">
        <Clock className="h-3 w-3" />
        <span>Chat expired</span>
      </div>
    );
  }

  // Dark-mode chats are ephemeral: auto-expire in 24h, no stop-timer option.
  if (chatMode === 'dark') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full"
        title="Dark-mode chats are ephemeral and disappear when the timer ends."
      >
        <Clock className="h-3 w-3" />
        <span className="font-medium">Ephemeral · {timeLeft}</span>
      </div>
    );
  }

  // Show incoming stop request from other user
  if (stopRequest && stopRequest.sender_id !== currentUserId) {
    return (
      <div className="flex items-center gap-2 bg-accent/30 border border-border px-3 py-1.5 rounded-full">
        <StopCircle className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Stop timer?</span>
        <Button
          size="icon"
          variant="default"
          className="h-6 w-6 rounded-full"
          disabled={sending}
          onClick={() => respondToStopRequest(true)}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-6 w-6 rounded-full"
          disabled={sending}
          onClick={() => respondToStopRequest(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Show pending request sent by current user
  if (stopRequest && stopRequest.sender_id === currentUserId) {
    const cancelStop = async () => {
      setSending(true);
      const { error } = await supabase
        .from('timer_stop_requests')
        .update({ status: 'cancelled' } as any)
        .eq('id', stopRequest.id);
      setSending(false);
      if (error) {
        toast.error('Failed to cancel request');
      } else {
        setStopRequest(null);
        toast.success('Request cancelled');
      }
    };
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 pl-3 pr-1 py-1 rounded-full">
        <Clock className="h-3 w-3 animate-pulse" />
        <span>{timeLeft}</span>
        <span className="text-primary">• Sent</span>
        <button
          type="button"
          onClick={cancelStop}
          disabled={sending}
          aria-label="Cancel request"
          className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={sendStopRequest}
      disabled={sending}
      className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-accent/30 px-3 py-1 rounded-full transition-colors cursor-pointer"
      title="Click to request stopping the timer"
    >
      <Clock className="h-3 w-3" />
      <span>{timeLeft}</span>
      <StopCircle className="h-3 w-3 text-primary opacity-60" />
    </button>
  );
};

export default ChatTimer;
