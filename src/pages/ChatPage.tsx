import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { moderateMessage } from '@/lib/moderation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowDown, Send, Smile, LogOut, WandSparkles, Flag, Ban, MoreVertical, Reply, X, Trash2, Undo2, Users, UserPlus2 } from 'lucide-react';
import MediaUploader from '@/components/chat/MediaUploader';
import MediaMessage from '@/components/chat/MediaMessage';
import GroupInfoSheet from '@/components/chat/GroupInfoSheet';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ChatTimer from '@/components/ChatTimer';
import TypingIndicator from '@/components/chat/TypingIndicator';
import SeenIndicator from '@/components/chat/SeenIndicator';
import TruthOrDare from '@/components/chat/TruthOrDare';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import SceneGenerator from '@/components/chat/SceneGenerator';
import SwipeableMessage from '@/components/chat/SwipeableMessage';
import TranslatedMessage from '@/components/chat/TranslatedMessage';
import ChatModeSwitch from '@/components/ChatModeSwitch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  reply_to: string | null;
  media_type?: string | null;
  media_path?: string | null;
  view_once?: boolean;
  expires_at?: string | null;
  viewed_by?: string[] | null;
  deleted_for_all?: boolean;
}

interface ChatInfo {
  id: string;
  expires_at: string | null;
  timer_stopped: boolean;
  mode: 'light' | 'dark';
  is_group: boolean;
  name: string | null;
  image_url: string | null;
  created_by: string | null;
}

const EMOJI_LIST = ['😊', '❤️', '😂', '🥰', '😘', '💕', '🔥', '😈', '💫', '🌙', '🐼', '🦊', '✨', '💖', '🙈'];

const ChatPage = () => {
  const { chatId } = useParams();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ alias: string; emoji_avatar: string } | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const chatInfoRef = useRef<ChatInfo | null>(null);
  useEffect(() => { chatInfoRef.current = chatInfo; }, [chatInfo]);
  const [expired, setExpired] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [continuationTrigger, setContinuationTrigger] = useState(0);
  const [chatMode, setChatMode] = useState<'light' | 'dark'>('light');
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [blockSending, setBlockSending] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, { remaining: number }>>({});
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [reportMsgReason, setReportMsgReason] = useState('');
  const [reportMsgTarget, setReportMsgTarget] = useState<Message | null>(null);
  const [reportingMsg, setReportingMsg] = useState(false);
  const pendingTimersRef = useRef<Record<string, { timeout: number; interval: number }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevMessageCountRef = useRef(0);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [unreadNew, setUnreadNew] = useState(0);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeName, setUpgradeName] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!chatId) return;
    setUpgrading(true);
    const { error } = await supabase.rpc('upgrade_chat_to_group' as any, { p_chat_id: chatId, p_name: upgradeName });
    setUpgrading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Converted to group');
    setUpgradeOpen(false);
    setUpgradeName('');
    loadChatInfo();
  };

  const { isOtherTyping, sendTyping } = useTypingIndicator(chatId, userId);

  const markAsRead = useCallback(async () => {
    if (!chatId || !userId) return;
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', userId);
  }, [chatId, userId]);

  useEffect(() => {
    if (!chatId || !userId) return;
    const init = async () => {
      setLoadingChat(true);
      await Promise.all([loadChatInfo(), loadMessages(), loadOtherUser()]);
      setLoadingChat(false);
    };
    init();

    const msgChannel = supabase
      .channel(`chat-msg-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => {
        loadMessages();
        markAsRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated?.deleted_for_all) {
          setMessages(prev => prev.filter(m => m.id !== updated.id));
        } else {
          setMessages(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) setMessages(prev => prev.filter(m => m.id !== deletedId));
      })
      .subscribe();

    const chatChannel = supabase
      .channel(`chat-info-${chatId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, (payload) => {
        const updated = payload.new as any;
        setChatInfo(prev => prev ? { ...prev, timer_stopped: updated.timer_stopped ?? prev.timer_stopped, expires_at: updated.expires_at ?? prev.expires_at, mode: updated.mode ?? prev.mode } : prev);
        if (updated.mode) setChatMode(updated.mode);
      })
      .subscribe();

    const participantChannel = supabase
      .channel(`chat-participants-${chatId}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_participants', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const deleted = payload.old as any;
        if (deleted.user_id !== userId && !chatInfo?.is_group) setChatEnded(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.user_id !== userId && updated.last_read_at) setOtherLastReadAt(updated.last_read_at);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [chatId, userId, markAsRead]);

  useEffect(() => {
    if (messages.length > 0) markAsRead();
  }, [messages.length, markAsRead]);

  // Sync the global app theme to the chat's mode so every screen/component
  // (header, inputs, dialogs, scene generator, etc.) consistently follows it
  // while the user is inside this chat. Restore the user's prior preference on exit.
  const userPrefModeRef = useRef<'light' | 'dark'>((localStorage.getItem('mrsmrb-mode') as 'light' | 'dark') || 'light');
  useEffect(() => {
    if (!chatInfo) return;
    if (mode !== chatMode) setMode(chatMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode, chatInfo?.id]);
  useEffect(() => {
    return () => { setMode(userPrefModeRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: scroll to absolute bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    setShowJumpButton(false);
    setUnreadNew(0);
  }, []);

  // Initial load: synchronously pin to bottom BEFORE paint, then re-pin across a few
  // frames to absorb late layout shifts (avatars, fonts, images).
  useLayoutEffect(() => {
    if (loadingChat) return;
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0 || initialScrollDoneRef.current) return;

    const pin = () => { container.scrollTop = container.scrollHeight; };
    pin();
    const raf1 = requestAnimationFrame(() => {
      pin();
      const raf2 = requestAnimationFrame(() => {
        pin();
        // Final pin after a short delay to catch image/font load shifts
        setTimeout(() => {
          const c = messagesContainerRef.current;
          if (c) c.scrollTop = c.scrollHeight;
          initialScrollDoneRef.current = true;
          prevMessageCountRef.current = messages.length;
        }, 120);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [loadingChat, messages.length]);

  // On new messages after initial load: auto-scroll if near bottom or it's my own
  // message; otherwise show "Jump to latest" with unread count.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !initialScrollDoneRef.current) return;
    const prev = prevMessageCountRef.current;
    const delta = messages.length - prev;
    prevMessageCountRef.current = messages.length;
    if (delta <= 0) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const last = messages[messages.length - 1];
    const isMine = last?.sender_id === userId;
    if (isMine || distanceFromBottom < 160) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setUnreadNew((n) => n + delta);
      setShowJumpButton(true);
    }
  }, [messages, userId]);

  // Auto-scroll for typing indicator if user is already near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isOtherTyping) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 160) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOtherTyping]);

  // Track scroll position to toggle the jump-to-latest button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 80) {
        setShowJumpButton(false);
        setUnreadNew(0);
      } else if (distanceFromBottom > 200) {
        setShowJumpButton(true);
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [chatId]);

  // Reset state when chat changes
  useEffect(() => {
    initialScrollDoneRef.current = false;
    prevMessageCountRef.current = 0;
    setShowJumpButton(false);
    setUnreadNew(0);
  }, [chatId]);

  useEffect(() => {
    if (!chatInfo || chatInfo.timer_stopped || !chatInfo.expires_at) { setExpired(false); return; }
    const check = () => { if (new Date(chatInfo.expires_at!).getTime() <= Date.now()) setExpired(true); };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [chatInfo]);

  const loadChatInfo = async () => {
    if (!chatId) return;
    const { data } = await supabase.from('chats').select('id, expires_at, timer_stopped, mode, is_group, name, image_url, created_by').eq('id', chatId).single();
    if (data) { setChatInfo(data as any); setChatMode((data as any).mode || 'light'); }
  };

  const loadMessages = async () => {
    if (!chatId) return;
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).eq('deleted_for_all', false).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  const loadOtherUser = async () => {
    if (!chatId || !userId) return;
    const { data: parts } = await supabase.from('chat_participants').select('user_id, last_read_at').eq('chat_id', chatId);
    const otherParticipants = parts?.filter(p => p.user_id !== userId) || [];
    if (otherParticipants.length === 0) {
      setOtherUserId(null);
      // Group/mood rooms can legitimately have only the current user present
      if (!chatInfo?.is_group) setChatEnded(true);
      return;
    }
    const other = otherParticipants[0];
    if (other.last_read_at) setOtherLastReadAt(other.last_read_at);
    if (other.user_id) {
      setOtherUserId(other.user_id);
      const { data: prof } = await supabase.rpc('get_public_profile_by_ids', { user_ids: [other.user_id] });
      if (prof && prof.length > 0) setOtherUser(prof[0]);
    }
  };

  const loadMyMute = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('muted_until, is_suspended').eq('user_id', userId).maybeSingle();
    if (data) setMutedUntil((data as any).muted_until ?? null);
  }, [userId]);

  useEffect(() => { loadMyMute(); }, [loadMyMute]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !chatId || expired || chatEnded) return;
    if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(mutedUntil).getTime() - Date.now()) / 60000);
      toast.error(`You are muted for ${mins} more minute${mins === 1 ? '' : 's'}.`);
      return;
    }
    const result = moderateMessage(newMessage, chatMode);
    if (result.blocked) {
      toast.error(result.reason);
      try {
        const { data } = await supabase.rpc('process_violation' as any, { _content: newMessage, _mode: chatMode });
        const info = data as any;
        if (info?.suspended) {
          toast.error('Account suspended due to repeated violations.');
          navigate('/suspended');
        } else if (info?.muted_until) {
          setMutedUntil(info.muted_until);
          toast.warning(`Strike ${info.strike}/5 — you are muted until ${new Date(info.muted_until).toLocaleTimeString()}`);
        } else {
          toast.warning(`Warning ${info?.strike ?? ''}/5 — continued violations will mute or suspend your account.`);
        }
      } catch (err) { /* ignore */ }
      return;
    }
    setSending(true);
    const insertData: any = { chat_id: chatId, sender_id: userId, content: newMessage.trim() };
    if (replyTo) insertData.reply_to = replyTo.id;
    const { error } = await supabase.from('messages').insert(insertData);
    if (error) toast.error('Failed to send message');
    setNewMessage('');
    setReplyTo(null);
    setSending(false);
    setShowEmoji(false);
  };

  const handleReportMessage = async () => {
    if (!reportMsgTarget || !otherUserId || !chatId) return;
    if (reportMsgReason.trim().length < 5) { toast.error('Please describe the issue (min 5 chars).'); return; }
    setReportingMsg(true);
    const { error } = await supabase.rpc('report_message' as any, {
      _reported_user_id: otherUserId,
      _chat_id: chatId,
      _message_id: reportMsgTarget.id,
      _message_content: reportMsgTarget.content,
      _reason: reportMsgReason.trim(),
    });
    setReportingMsg(false);
    if (error) { toast.error('Failed to submit report'); return; }
    toast.success('Message reported. Our team will review it.');
    setReportMsgReason('');
    setReportMsgTarget(null);
  };

  const sendGameMessage = async (content: string) => {
    if (!userId || !chatId || expired || chatEnded) return;
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: userId, content });
    setShowEmoji(false);
  };

  const sendGeneratedScene = async (content: string) => { await sendGameMessage(content); };

  const handleEndChat = async () => {
    if (!chatId || !userId) return;
    try {
      const { error } = await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', userId);
      if (error) throw error;
      toast.success('You left the chat.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error('Failed to end chat: ' + (err.message || 'Unknown error'));
    }
  };

  const handleReport = async () => {
    if (!userId || !chatId || !reportReason.trim()) return;
    if (reportReason.trim().length < 5 || reportReason.trim().length > 500) { toast.error('Please provide a reason (5-500 characters)'); return; }
    setReportSending(true);
    const { data: recentMsgs } = await supabase.from('messages').select('sender_id, content, created_at').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(5);
    const msgContext = (recentMsgs ?? []).reverse().map(m => `[${m.sender_id === userId ? 'Me' : otherUser?.alias || 'Other'}] ${m.content}`).join('\n');
    const ticketMessage = `**Report against:** ${otherUser?.alias || 'Unknown'} (${otherUser?.emoji_avatar || ''})\n**Chat ID:** ${chatId}\n**Chat Mode:** ${chatMode}\n\n**Reason:**\n${reportReason.trim()}\n\n**Recent messages:**\n${msgContext || '(no messages)'}`;
    const { error } = await supabase.from('support_tickets').insert({ user_id: userId, subject: `Report: ${otherUser?.alias || 'User'} in chat`, message: ticketMessage } as any);
    if (otherUserId) { await supabase.rpc('record_user_report', { _reported_user_id: otherUserId }); }
    setReportSending(false);
    if (error) { toast.error('Failed to submit report'); } else { toast.success('Report submitted. Our team will review it.'); setReportReason(''); setShowReportDialog(false); }
  };

  const handleBlockUser = async () => {
    if (!userId || !otherUserId) return;
    setBlockSending(true);
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: userId, blocked_id: otherUserId } as any);
    setBlockSending(false);
    if (error) { if (error.code === '23505') toast.info('User already blocked'); else toast.error('Failed to block user'); }
    else {
      toast.success(`${otherUser?.alias || 'User'} has been blocked.`);
      await supabase.from('chat_participants').delete().eq('chat_id', chatId!).eq('user_id', userId);
      navigate('/dashboard');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewMessage(e.target.value); sendTyping(); };

  const getReplyContent = (replyToId: string | null) => {
    if (!replyToId) return null;
    return messages.find(m => m.id === replyToId);
  };

  // Cleanup pending-delete timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pendingTimersRef.current).forEach(({ timeout, interval }) => {
        clearTimeout(timeout);
        clearInterval(interval);
      });
    };
  }, []);

  const startDeleteForEveryone = (msg: Message) => {
    if (msg.sender_id !== userId) return;
    if (pendingTimersRef.current[msg.id]) return;

    setPendingDeletes(prev => ({ ...prev, [msg.id]: { remaining: 5 } }));

    const interval = window.setInterval(() => {
      setPendingDeletes(prev => {
        const cur = prev[msg.id];
        if (!cur) return prev;
        const next = Math.max(0, cur.remaining - 1);
        return { ...prev, [msg.id]: { remaining: next } };
      });
    }, 1000);

    const timeout = window.setTimeout(async () => {
      clearInterval(interval);
      delete pendingTimersRef.current[msg.id];
      const { error } = await supabase.from('messages').delete().eq('id', msg.id);
      setPendingDeletes(prev => {
        const { [msg.id]: _omit, ...rest } = prev;
        return rest;
      });
      if (error) {
        toast.error('Failed to delete message');
      } else {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      }
    }, 5000);

    pendingTimersRef.current[msg.id] = { timeout, interval };
  };

  const undoDelete = (msgId: string) => {
    const t = pendingTimersRef.current[msgId];
    if (t) {
      clearTimeout(t.timeout);
      clearInterval(t.interval);
      delete pendingTimersRef.current[msgId];
    }
    setPendingDeletes(prev => {
      const { [msgId]: _omit, ...rest } = prev;
      return rest;
    });
    toast.success('Deletion undone');
  };

  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1200);
    }
  };

  if (loadingChat) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading chat...</div>;
  }

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-3 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full flex-shrink-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xl flex-shrink-0">{chatInfo?.is_group ? '👥' : (otherUser?.emoji_avatar || '💬')}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-semibold text-foreground leading-none truncate text-sm">
              {chatInfo?.is_group ? (chatInfo.name || 'Group chat') : (otherUser?.alias || 'Anonymous')}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {isOtherTyping ? 'typing...' : chatMode === 'light' ? '🌞 Light' : '🌑 Dark'}
            </span>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {chatInfo && userId && (
              <ChatModeSwitch chatId={chatId!} chatMode={chatMode} currentUserId={userId} otherUserId={otherUserId} otherUserAlias={otherUser?.alias} onModeChanged={(newMode) => { setChatMode(newMode); setChatInfo(prev => prev ? { ...prev, mode: newMode } : prev); }} />
            )}
            {chatInfo && userId && (
              <ChatTimer chatId={chatId!} expiresAt={chatInfo.expires_at} timerStopped={chatInfo.timer_stopped} currentUserId={userId} />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {chatInfo?.is_group ? (
                  <DropdownMenuItem onClick={() => setGroupInfoOpen(true)}>
                    <Users className="h-4 w-4 mr-2" /> Group info
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setUpgradeOpen(true)}>
                    <UserPlus2 className="h-4 w-4 mr-2" /> Convert to group
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowReportDialog(true)} className="text-amber-500 focus:text-amber-500">
                  <Flag className="h-4 w-4 mr-2" />
                  Report User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBlockDialog(true)} className="text-muted-foreground focus:text-destructive">
                  <Ban className="h-4 w-4 mr-2" />
                  Block User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEndDialog(true)} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  End Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Report Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report {otherUser?.alias || 'this user'}?</AlertDialogTitle>
            <AlertDialogDescription>Describe the issue. Recent messages will be included for context.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="What happened? (min 5 characters)" value={reportReason} onChange={(e) => setReportReason(e.target.value)} maxLength={500} className="min-h-[80px]" />
          <p className="text-xs text-muted-foreground text-right">{reportReason.length}/500</p>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport} disabled={reportSending || reportReason.trim().length < 5} className="bg-amber-500 text-white hover:bg-amber-600">
              {reportSending ? 'Sending...' : 'Submit Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {otherUser?.alias || 'this user'}?</AlertDialogTitle>
            <AlertDialogDescription>They won't be able to contact you and you'll never be matched again. This will also end the current chat.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} disabled={blockSending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {blockSending ? 'Blocking...' : 'Block User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message action sheet (long-press on own message) */}
      <AlertDialog open={!!actionMessage} onOpenChange={(open) => !open && setActionMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Message options</AlertDialogTitle>
            <AlertDialogDescription className="line-clamp-3 italic">
              "{actionMessage?.content}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionMessage) startDeleteForEveryone(actionMessage);
                setActionMessage(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete for Everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pending-delete snackbar */}
      {Object.keys(pendingDeletes).length > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-1.5 w-[min(92vw,420px)]">
          {Object.entries(pendingDeletes).map(([id, { remaining }]) => (
            <div
              key={id}
              className="flex items-center justify-between gap-3 bg-foreground text-background rounded-full pl-4 pr-1.5 py-1.5 shadow-lg animate-fade-in"
            >
              <span className="text-xs font-medium">
                Deleting in {remaining}s…
              </span>
              <button
                type="button"
                onClick={() => undoDelete(id)}
                className="flex items-center gap-1 bg-background/15 hover:bg-background/25 transition-colors text-background text-xs font-semibold rounded-full px-3 py-1"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this chat?</AlertDialogTitle>
            <AlertDialogDescription>You will leave this conversation. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">End Chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report message dialog */}
      <AlertDialog open={!!reportMsgTarget} onOpenChange={(open) => { if (!open) { setReportMsgTarget(null); setReportMsgReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this message?</AlertDialogTitle>
            <AlertDialogDescription className="italic line-clamp-3">"{reportMsgTarget?.content}"</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Why are you reporting this? (min 5 chars)" value={reportMsgReason} onChange={(e) => setReportMsgReason(e.target.value)} maxLength={500} className="min-h-[80px]" />
          <p className="text-xs text-muted-foreground text-right">{reportMsgReason.length}/500</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportMessage} disabled={reportingMsg || reportMsgReason.trim().length < 5} className="bg-amber-500 text-white hover:bg-amber-600">
              {reportingMsg ? 'Sending...' : 'Report Message'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {chatEnded && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Chat Ended</h3>
            <p className="text-muted-foreground text-sm mb-6">This chat has been ended.</p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      )}

      {/* Expired overlay */}
      {!chatEnded && expired && !chatInfo?.timer_stopped && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">⏰</div>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Chat Expired</h3>
            <p className="text-muted-foreground text-sm mb-6">This 24-hour chat has ended.</p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      )}

      {/* Messages area */}
      {!chatEnded && (!expired || chatInfo?.timer_stopped) && (
        <>
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
            <div className="flex justify-center mb-4">
              <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full text-center max-w-xs">
                {chatInfo?.timer_stopped ? '✅ Timer stopped — this chat is permanent' : '⏳ This chat expires in 24 hours.'}
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const otherMsgIdsForAuto = new Set(
                  messages.filter(m => m.sender_id !== user?.id).slice(-2).map(m => m.id)
                );
                return messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const isSeen = isMe && !!otherLastReadAt && new Date(otherLastReadAt) >= new Date(msg.created_at);
                const isScene = msg.content.startsWith('📖 Scene');
                const isOtherScene = isScene && !isMe;
                const repliedMsg = getReplyContent(msg.reply_to);
                const isPendingDelete = !!pendingDeletes[msg.id];
                const interactive = !expired && !chatEnded;
                const shouldAuto = !isMe && otherMsgIdsForAuto.has(msg.id) && (profile as any)?.auto_translate_enabled !== false;
                return (
                  <div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }} className="rounded-2xl transition-shadow">
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`flex items-end gap-1 ${isMe ? 'max-w-[75%] ml-auto' : 'max-w-[75%] mr-auto'}`}>
                        {/* Desktop reply button (other's messages) */}
                        {!isMe && interactive && !isPendingDelete && (
                          <button
                            onClick={() => setReplyTo(msg)}
                            className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted mb-1 flex-shrink-0"
                          >
                            <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <SwipeableMessage
                          isMe={isMe}
                          disabled={!interactive || isPendingDelete}
                          onReply={() => setReplyTo(msg)}
                          onLongPress={() => isMe ? setActionMessage(msg) : setReportMsgTarget(msg)}
                        >
                          <div className={`rounded-2xl px-4 py-2.5 text-sm select-none ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'} ${isScene ? 'border border-border/40 italic' : ''} ${isPendingDelete ? 'opacity-40 line-through' : ''}`}>
                            {repliedMsg && (
                              <button
                                type="button"
                                onClick={() => scrollToMessage(repliedMsg.id)}
                                className={`mb-1.5 px-2 py-1 rounded-lg text-xs border-l-2 block w-full text-left ${isMe ? 'bg-primary-foreground/10 border-primary-foreground/40 text-primary-foreground/80' : 'bg-background/50 border-primary/40 text-muted-foreground'}`}
                              >
                                <span className="font-medium">{repliedMsg.sender_id === userId ? 'You' : otherUser?.alias || 'Them'}</span>
                                <p className="truncate">{repliedMsg.content.substring(0, 60)}{repliedMsg.content.length > 60 ? '...' : ''}</p>
                              </button>
                            )}
                            {msg.media_path && userId ? (
                              <MediaMessage
                                messageId={msg.id}
                                mediaPath={msg.media_path}
                                mediaType={msg.media_type || 'file'}
                                viewOnce={!!msg.view_once}
                                expiresAt={msg.expires_at || null}
                                isMine={isMe}
                                viewedBy={msg.viewed_by || []}
                                currentUserId={userId}
                              />
                            ) : isMe ? (
                              msg.content
                            ) : (
                              <TranslatedMessage
                                messageId={msg.id}
                                content={msg.content}
                                primaryLanguage={(profile as any)?.primary_language || 'en'}
                                secondaryLanguage={(profile as any)?.secondary_language || null}
                                autoTranslate={shouldAuto}
                                isMine={false}
                              />
                            )}
                            <div className={`flex items-center gap-0.5 mt-1 ${isMe ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'}`}>
                              <span className="text-[10px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && <SeenIndicator isSeen={isSeen} />}
                            </div>
                          </div>
                        </SwipeableMessage>
                        {/* Desktop reply button (own messages) */}
                        {isMe && interactive && !isPendingDelete && (
                          <button
                            onClick={() => setReplyTo(msg)}
                            className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted mb-1"
                          >
                            <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isOtherScene && !expired && !chatEnded && (
                      <div className="flex justify-start mt-1 ml-1">
                        <button type="button" onClick={() => setContinuationTrigger(Date.now())} className="text-xs text-primary hover:underline flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                          <WandSparkles className="h-3 w-3" />
                          Continue this scene
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
              })()}
              {isOtherTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Jump to latest floating button */}
          {showJumpButton && (
            <div className="relative max-w-2xl mx-auto w-full pointer-events-none">
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                aria-label="Jump to latest messages"
                className="pointer-events-auto absolute right-4 -top-14 z-20 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 px-3 py-2 text-xs font-medium hover:scale-105 active:scale-95 transition-transform"
              >
                <ArrowDown className="h-4 w-4" />
                {unreadNew > 0 ? (
                  <>
                    {unreadNew} new
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                      {unreadNew > 99 ? '99+' : unreadNew}
                    </span>
                  </>
                ) : (
                  <span>Jump to latest</span>
                )}
              </button>
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="border-t border-border bg-card px-4 py-3 max-w-2xl mx-auto w-full">
              <div className="flex flex-wrap gap-2">
                {EMOJI_LIST.map(emoji => (
                  <button key={emoji} onClick={() => setNewMessage(prev => prev + emoji)} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
                ))}
              </div>
            </div>
          )}

          {/* Reply preview bar */}
          {replyTo && (
            <div className="border-t border-border bg-card/90 px-4 py-2 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2">
                <Reply className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                  <p className="text-xs font-medium text-primary">{replyTo.sender_id === userId ? 'You' : otherUser?.alias || 'Them'}</p>
                  <p className="text-xs text-muted-foreground truncate">{replyTo.content.substring(0, 80)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setReplyTo(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="sticky bottom-0 border-t border-border bg-card/80 backdrop-blur-md px-3 py-2.5">
            <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowEmoji(!showEmoji)} className="rounded-full flex-shrink-0 h-8 w-8">
                <Smile className="h-5 w-5" />
              </Button>
              <TruthOrDare onSend={sendGameMessage} disabled={expired || chatEnded} />
              {chatId && userId && <MediaUploader chatId={chatId} senderId={userId} disabled={expired || chatEnded} />}
              {chatId && otherUserId && (
                <SceneGenerator mode={mode as 'light' | 'dark'} chatId={chatId} otherUserId={otherUserId} disabled={expired || chatEnded || sending} onSend={sendGeneratedScene} continuationTrigger={continuationTrigger} />
              )}
              <Input value={newMessage} onChange={handleInputChange} placeholder="Type a message..." className="flex-1 rounded-full h-9 text-sm" maxLength={2000} />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="rounded-full flex-shrink-0 h-8 w-8">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}

      {chatInfo?.is_group && userId && chatId && (
        <GroupInfoSheet
          open={groupInfoOpen}
          onOpenChange={setGroupInfoOpen}
          chatId={chatId}
          currentUserId={userId}
          onLeft={() => { setGroupInfoOpen(false); navigate('/dashboard'); }}
        />
      )}

      <AlertDialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to group chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This chat becomes a group. The timer stops and you can invite more people. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Group name"
            value={upgradeName}
            onChange={(e) => setUpgradeName(e.target.value)}
            maxLength={60}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpgrade} disabled={upgrading}>
              {upgrading ? 'Converting…' : 'Convert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatPage;
