import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { moderateMessage } from '@/lib/moderation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Smile } from 'lucide-react';
import { toast } from 'sonner';
import ChatTimer from '@/components/ChatTimer';

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
}

const EMOJI_LIST = ['😊', '❤️', '😂', '🥰', '😘', '💕', '🔥', '😈', '💫', '🌙', '🐼', '🦊', '✨', '💖', '🙈'];

const ChatPage = () => {
  const { chatId } = useParams();
  const { user } = useAuth();
  const { mode } = useMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ alias: string; emoji_avatar: string } | null>(null);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [expired, setExpired] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

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
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
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
        } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [chatId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      .select('id, expires_at, timer_stopped')
      .eq('id', chatId)
      .single();
    if (data) setChatInfo(data as any);
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
    if (!chatId || !user) return;
    const { data: parts } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chatId);
    const otherId = parts?.find(p => p.user_id !== user.id)?.user_id;
    if (otherId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('alias, emoji_avatar')
        .eq('user_id', otherId)
        .single();
      if (prof) setOtherUser(prof);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId || expired) return;

    const result = moderateMessage(newMessage, mode as 'light' | 'dark');
    if (result.blocked) {
      toast.error(result.reason);
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (error) toast.error('Failed to send message');
    setNewMessage('');
    setSending(false);
    setShowEmoji(false);
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
              {mode === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}
            </span>
          </div>
          {chatInfo && user && (
            <ChatTimer
              chatId={chatId!}
              expiresAt={chatInfo.expires_at}
              timerStopped={chatInfo.timer_stopped}
              currentUserId={user.id}
            />
          )}
        </div>
      </header>

      {/* Expired overlay */}
      {expired && !chatInfo?.timer_stopped && (
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
      {(!expired || chatInfo?.timer_stopped) && (
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
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                      <div className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
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
