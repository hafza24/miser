import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { moderateMessage } from '@/lib/moderation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Smile, LogOut, WandSparkles, Flag, Ban } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ChatTimer from '@/components/ChatTimer';
import TypingIndicator from '@/components/chat/TypingIndicator';
import SeenIndicator from '@/components/chat/SeenIndicator';
import TruthOrDare from '@/components/chat/TruthOrDare';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import SceneGenerator from '@/components/chat/SceneGenerator';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface ChatInfo {
  id: string;
  expires_at: string | null;
  timer_stopped: boolean;
  mode: 'light' | 'dark';
}

const EMOJI_LIST = ['😊', '❤️', '😂', '🥰', '😘', '💕', '🔥', '😈', '💫', '🌙', '🐼', '🦊', '✨', '💖', '🙈'];

const ChatPage = () => {
  const { chatId } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const { mode } = useMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ alias: string; emoji_avatar: string } | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [expired, setExpired] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [continuationTrigger, setContinuationTrigger] = useState(0);
  const [chatMode, setChatMode] = useState<'light' | 'dark'>('light');
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [blockSending, setBlockSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isOtherTyping, sendTyping } = useTypingIndicator(chatId, userId);

  // Mark messages as read
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

    // Realtime messages
    const msgChannel = supabase
      .channel(`chat-msg-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, () => {
        loadMessages();
        markAsRead();
      })
      .subscribe();

    // Realtime chat updates (timer_stopped)
    const chatChannel = supabase
      .channel(`chat-info-${chatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setChatInfo(prev => prev ? {
          ...prev,
          timer_stopped: updated.timer_stopped ?? prev.timer_stopped,
          expires_at: updated.expires_at ?? prev.expires_at,
          mode: updated.mode ?? prev.mode,
        } : prev);
        if (updated.mode) setChatMode(updated.mode);
      })
      .subscribe();

    // Realtime participant changes
    const participantChannel = supabase
      .channel(`chat-participants-${chatId}`)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_participants',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const deleted = payload.old as any;
        if (deleted.user_id !== userId) {
          setChatEnded(true);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.user_id !== userId && updated.last_read_at) {
          setOtherLastReadAt(updated.last_read_at);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [chatId, userId, markAsRead]);

  // Mark as read on mount and when messages change
  useEffect(() => {
    if (messages.length > 0) markAsRead();
  }, [messages.length, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  // Check expiry
  useEffect(() => {
    if (!chatInfo || chatInfo.timer_stopped || !chatInfo.expires_at) {
      setExpired(false);
      return;
    }
    const check = () => {
      if (new Date(chatInfo.expires_at!).getTime() <= Date.now()) {
        setExpired(true);
      }
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [chatInfo]);

  const loadChatInfo = async () => {
    if (!chatId) return;
    const { data } = await supabase
      .from('chats')
      .select('id, expires_at, timer_stopped, mode')
      .eq('id', chatId)
      .single();
    if (data) {
      setChatInfo(data as any);
      setChatMode((data as any).mode || 'light');
    }
  };

  const loadMessages = async () => {
    if (!chatId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  const loadOtherUser = async () => {
    if (!chatId || !userId) return;
    const { data: parts } = await supabase
      .from('chat_participants')
      .select('user_id, last_read_at')
      .eq('chat_id', chatId);
    
    const otherParticipants = parts?.filter(p => p.user_id !== userId) || [];
    if (otherParticipants.length === 0) {
      setOtherUserId(null);
      setChatEnded(true);
      return;
    }

    const other = otherParticipants[0];
    if (other.last_read_at) setOtherLastReadAt(other.last_read_at);

    if (other.user_id) {
      setOtherUserId(other.user_id);
      const { data: prof } = await supabase
        .from('profiles')
        .select('alias, emoji_avatar')
        .eq('user_id', other.user_id)
        .single();
      if (prof) setOtherUser(prof);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !chatId || expired || chatEnded) return;

    const result = moderateMessage(newMessage, chatMode);
    if (result.blocked) {
      toast.error(result.reason);
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content: newMessage.trim(),
    });

    if (error) toast.error('Failed to send message');
    setNewMessage('');
    setSending(false);
    setShowEmoji(false);
  };

  const sendGameMessage = async (content: string) => {
    if (!userId || !chatId || expired || chatEnded) return;
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content,
    });
    setShowEmoji(false);
  };

  const sendGeneratedScene = async (content: string) => {
    await sendGameMessage(content);
  };

  const handleEndChat = async () => {
    if (!chatId || !userId) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('You left the chat.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error('Failed to end chat: ' + (err.message || 'Unknown error'));
    }
  };

  const handleReport = async () => {
    if (!userId || !chatId || !reportReason.trim()) return;
    if (reportReason.trim().length < 5 || reportReason.trim().length > 500) {
      toast.error('Please provide a reason (5-500 characters)');
      return;
    }
    setReportSending(true);
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('sender_id, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(5);
    const msgContext = (recentMsgs ?? [])
      .reverse()
      .map(m => `[${m.sender_id === userId ? 'Me' : otherUser?.alias || 'Other'}] ${m.content}`)
      .join('\n');
    const ticketMessage = `**Report against:** ${otherUser?.alias || 'Unknown'} (${otherUser?.emoji_avatar || ''})\n**Chat ID:** ${chatId}\n**Chat Mode:** ${chatMode}\n\n**Reason:**\n${reportReason.trim()}\n\n**Recent messages:**\n${msgContext || '(no messages)'}`;
    const { error } = await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: `Report: ${otherUser?.alias || 'User'} in chat`,
      message: ticketMessage,
    } as any);
    setReportSending(false);
    if (error) {
      toast.error('Failed to submit report');
    } else {
      toast.success('Report submitted. Our team will review it.');
      setReportReason('');
    }
  };

  const handleBlockUser = async () => {
    if (!userId || !otherUserId) return;
    setBlockSending(true);
    const { error } = await supabase.from('blocked_users').insert({
      blocker_id: userId,
      blocked_id: otherUserId,
    } as any);
    setBlockSending(false);
    if (error) {
      if (error.code === '23505') {
        toast.info('User already blocked');
      } else {
        toast.error('Failed to block user');
      }
    } else {
      toast.success(`${otherUser?.alias || 'User'} has been blocked. You won't be matched again.`);
      // End the chat after blocking
      await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId!)
        .eq('user_id', userId);
      navigate('/dashboard');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    sendTyping();
  };

  if (loadingChat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-2xl">{otherUser?.emoji_avatar || '💬'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-semibold text-foreground leading-none truncate">
              {otherUser?.alias || 'Anonymous'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {isOtherTyping ? 'typing...' : chatMode === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}
            </span>
          </div>
          {chatInfo && userId && (
            <ChatModeSwitch
              chatId={chatId!}
              chatMode={chatMode}
              currentUserId={userId}
              onModeChanged={(newMode) => {
                setChatMode(newMode);
                setChatInfo(prev => prev ? { ...prev, mode: newMode } : prev);
              }}
            />
          )}
          {chatInfo && userId && (
            <ChatTimer
              chatId={chatId!}
              expiresAt={chatInfo.expires_at}
              timerStopped={chatInfo.timer_stopped}
              currentUserId={userId}
            />
          )}
          {/* Report user */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-amber-500 hover:text-amber-600 hover:bg-amber-500/10">
                <Flag className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Report {otherUser?.alias || 'this user'}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Describe the issue. Recent messages will be included automatically for context.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                placeholder="What happened? (min 5 characters)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                maxLength={500}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground text-right">{reportReason.length}/500</p>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setReportReason('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReport}
                  disabled={reportSending || reportReason.trim().length < 5}
                  className="bg-amber-500 text-white hover:bg-amber-600"
                >
                  {reportSending ? 'Sending...' : 'Submit Report'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* End chat */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End this chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will leave this conversation and it will be removed from your chat list. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  End Chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Chat ended overlay */}
      {chatEnded && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Chat Ended</h3>
            <p className="text-muted-foreground text-sm mb-6">
              This chat has been ended. You can no longer send messages.
            </p>
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
            <p className="text-muted-foreground text-sm mb-6">
              This 24-hour chat has ended.
            </p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      )}

      {/* Messages area */}
      {!chatEnded && (!expired || chatInfo?.timer_stopped) && (
        <>
          <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
            {/* System message */}
            <div className="flex justify-center mb-4">
              <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full text-center max-w-xs">
                {chatInfo?.timer_stopped
                  ? '✅ Timer stopped — this chat is permanent'
                  : '⏳ This chat expires in 24 hours. Click the timer to request making it permanent.'}
              </div>
            </div>

            <div className="space-y-3">
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                const isLastOwnMsg = isMe && !messages.slice(idx + 1).some(m => m.sender_id === user?.id);
                const isSeen = isMe && !!otherLastReadAt && new Date(otherLastReadAt) >= new Date(msg.created_at);
                const isScene = msg.content.startsWith('📖 Scene');
                const isOtherScene = isScene && !isMe;
                return (
                  <div key={msg.id}>
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        } ${isScene ? 'border border-border/40 italic' : ''}`}
                      >
                        {msg.content}
                        <div className={`flex items-center gap-0.5 mt-1 ${isMe ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'}`}>
                          <span className="text-[10px]">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && <SeenIndicator isSeen={isSeen} />}
                        </div>
                      </div>
                    </div>
                    {isOtherScene && !expired && !chatEnded && (
                      <div className="flex justify-start mt-1 ml-1">
                        <button
                          type="button"
                          onClick={() => setContinuationTrigger(Date.now())}
                          className="text-xs text-primary hover:underline flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <WandSparkles className="h-3 w-3" />
                          Continue this scene
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {isOtherTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Emoji picker */}
          {showEmoji && (
            <div className="border-t border-border bg-card px-4 py-3 max-w-2xl mx-auto w-full">
              <div className="flex flex-wrap gap-2">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setNewMessage(prev => prev + emoji)}
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="sticky bottom-0 border-t border-border bg-card/80 backdrop-blur-md px-4 py-3">
            <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowEmoji(!showEmoji)}
                className="rounded-full flex-shrink-0"
              >
                <Smile className="h-5 w-5" />
              </Button>
              <TruthOrDare onSend={sendGameMessage} disabled={expired || chatEnded} />
              {chatId && otherUserId && (
                <SceneGenerator
                  mode={mode as 'light' | 'dark'}
                  chatId={chatId}
                  otherUserId={otherUserId}
                  disabled={expired || chatEnded || sending}
                  onSend={sendGeneratedScene}
                  continuationTrigger={continuationTrigger}
                />
              )}
              <Input
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 rounded-full"
                maxLength={2000}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || sending}
                className="rounded-full flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPage;
