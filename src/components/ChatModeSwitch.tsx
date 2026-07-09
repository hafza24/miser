import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModeSwitchRequest {
  id: string;
  chat_id: string;
  sender_id: string;
  target_mode: string;
  status: string;
}

interface ChatModeSwitchProps {
  chatId: string;
  chatMode: 'light' | 'dark';
  currentUserId: string;
  otherUserId?: string | null;
  otherUserAlias?: string | null;
  onModeChanged: (newMode: 'light' | 'dark') => void;
}

const ChatModeSwitch = ({ chatId, chatMode, currentUserId, otherUserId, otherUserAlias, onModeChanged }: ChatModeSwitchProps) => {
  const navigate = useNavigate();
  const [request, setRequest] = useState<ModeSwitchRequest | null>(null);
  const [sending, setSending] = useState(false);
  const [lightBlocked, setLightBlocked] = useState(false);
  const [darkBlocked, setDarkBlocked] = useState(false);
  const [selfHasDark, setSelfHasDark] = useState(false);
  const [otherHasDark, setOtherHasDark] = useState(false);

  useEffect(() => {
    const loadRestrictions = async () => {
      const [{ data: profile }, { data: selfDark }] = await Promise.all([
        supabase.from('profiles').select('light_mode_blocked, dark_mode_blocked').eq('user_id', currentUserId).single(),
        supabase.rpc('user_has_dark_access' as any, { _user_id: currentUserId }),
      ]);
      if (profile) {
        setLightBlocked((profile as any).light_mode_blocked ?? false);
        setDarkBlocked((profile as any).dark_mode_blocked ?? false);
      }
      setSelfHasDark(Boolean(selfDark));
      if (otherUserId) {
        const { data: otherDark } = await supabase.rpc('user_has_dark_access' as any, { _user_id: otherUserId });
        setOtherHasDark(Boolean(otherDark));
      }
    };
    loadRestrictions();
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    const loadRequest = async () => {
      const { data } = await supabase
        .from('mode_switch_requests')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .limit(1);
      if (data && data.length > 0) setRequest(data[0] as ModeSwitchRequest);
    };
    loadRequest();

    const channel = supabase
      .channel(`mode-switch-${chatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mode_switch_requests',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRequest(payload.new as ModeSwitchRequest);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as ModeSwitchRequest;
          if (updated.status !== 'pending') {
            setRequest(null);
            if (updated.status === 'accepted') {
              toast.success(`Chat switched to ${updated.target_mode} mode!`);
              onModeChanged(updated.target_mode as 'light' | 'dark');
            } else if (updated.status === 'declined' && updated.sender_id === currentUserId) {
              toast.info('Mode switch request declined.');
            }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, currentUserId, onModeChanged]);

  const switchToDark = async () => {
    if (darkBlocked) {
      navigate('/subscription');
      return;
    }
    if (!selfHasDark) {
      toast.error("You're on the Basic plan — upgrade to unlock Dark Mode.");
      navigate('/subscription');
      return;
    }
    if (otherUserId && !otherHasDark) {
      toast.error(`${otherUserAlias || 'Your chat partner'} is on the Basic plan and can't access Dark Mode.`);
      return;
    }
    // Light → Dark requires consent
    setSending(true);
    const { error } = await supabase.from('mode_switch_requests').insert({
      chat_id: chatId,
      sender_id: currentUserId,
      target_mode: 'dark',
    } as any);
    setSending(false);
    if (error) {
      toast.error('Failed to send request');
    } else {
      toast.success('Dark mode request sent!');
    }
  };

  const switchToLight = async () => {
    if (lightBlocked) {
      toast.error('Your access to Light mode has been restricted by an admin.');
      return;
    }
    // Dark → Light is instant, no consent needed
    setSending(true);
    const { error } = await supabase
      .from('chats')
      .update({ mode: 'light' } as any)
      .eq('id', chatId);
    setSending(false);
    if (error) {
      toast.error('Failed to switch mode');
    } else {
      toast.success('Switched to light mode!');
      onModeChanged('light');
    }
  };

  const respondToRequest = async (accept: boolean) => {
    if (!request) return;
    if (accept && request.target_mode === 'dark' && !selfHasDark) {
      // Auto-decline: receiver has no dark mode access.
      await supabase
        .from('mode_switch_requests')
        .update({ status: 'declined' })
        .eq('id', request.id);
      setRequest(null);
      toast.error("You're on the Basic plan — upgrade to accept Dark Mode requests.");
      navigate('/subscription');
      return;
    }
    setSending(true);

    if (accept) {
      await supabase
        .from('chats')
        .update({ mode: request.target_mode as any })
        .eq('id', chatId);
    }

    await supabase
      .from('mode_switch_requests')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', request.id);

    setSending(false);
    setRequest(null);
    if (accept) {
      onModeChanged(request.target_mode as 'light' | 'dark');
    }
    toast.success(accept ? `Switched to ${request.target_mode} mode!` : 'Request declined.');
  };

  // Incoming request from other user
  if (request && request.sender_id !== currentUserId) {
    const canAccept = !(request.target_mode === 'dark' && !selfHasDark);
    return (
      <div className="flex items-center gap-2 bg-accent/30 border border-border px-3 py-1.5 rounded-full">
        <Moon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">
          {canAccept ? 'Go dark?' : 'Dark requires Pro'}
        </span>
        <Button
          size="icon"
          variant="default"
          className="h-6 w-6 rounded-full"
          disabled={sending}
          onClick={() => respondToRequest(true)}
          title={canAccept ? 'Accept dark mode' : "You don't have Dark Mode access — tap to see plans"}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-6 w-6 rounded-full"
          disabled={sending}
          onClick={() => respondToRequest(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Pending request sent by current user
  if (request && request.sender_id === currentUserId) {
    const cancelRequest = async () => {
      setSending(true);
      const { error } = await supabase
        .from('mode_switch_requests')
        .update({ status: 'cancelled' } as any)
        .eq('id', request.id);
      setSending(false);
      if (error) {
        toast.error('Failed to cancel request');
      } else {
        setRequest(null);
        toast.success('Request cancelled');
      }
    };
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 pl-3 pr-1 py-1 rounded-full">
        <Moon className="h-3 w-3 animate-pulse" />
        <span className="text-primary">Dark request sent</span>
        <button
          type="button"
          onClick={cancelRequest}
          disabled={sending}
          aria-label="Cancel request"
          className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Toggle button
  if (chatMode === 'light') {
    return (
      <button
        onClick={switchToDark}
        disabled={sending}
        className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-accent/30 px-2 sm:px-3 py-1 rounded-full transition-colors cursor-pointer"
        title="Request to switch to dark mode (requires consent)"
      >
        <Sun className="h-3 w-3 text-amber-500" />
        <span className="hidden sm:inline">Light</span>
        <Moon className="h-3 w-3 opacity-40" />
      </button>
    );
  }

  return (
    <button
      onClick={switchToLight}
      disabled={sending}
      className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-accent/30 px-2 sm:px-3 py-1 rounded-full transition-colors cursor-pointer"
      title="Switch to light mode (instant)"
    >
      <Moon className="h-3 w-3 text-indigo-400" />
      <span className="hidden sm:inline">Dark</span>
      <Sun className="h-3 w-3 opacity-40" />
    </button>
  );
};

export default ChatModeSwitch;
