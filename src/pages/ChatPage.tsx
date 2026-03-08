import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { moderateMessage } from '@/lib/moderation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Image, Smile } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

const EMOJI_LIST = ['😊', '❤️', '😂', '🥰', '😘', '💕', '🔥', '😈', '💫', '🌙', '🐼', '🦊', '✨', '💖', '🙈'];

const ChatPage = () => {
  const { chatId } = useParams();
  const { user, profile } = useAuth();
  const { mode } = useMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ alias: string; emoji_avatar: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    loadMessages();
    loadOtherUser();

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId!)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  const loadOtherUser = async () => {
    const { data: parts } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chatId!);
    const otherId = parts?.find(p => p.user_id !== user!.id)?.user_id;
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
    if (!newMessage.trim() || !user || !chatId) return;

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

    if (error) {
      toast.error('Failed to send message');
    }
    setNewMessage('');
    setSending(false);
    setShowEmoji(false);
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-2xl">{otherUser?.emoji_avatar || '💬'}</span>
          <div>
            <h2 className="font-heading font-semibold text-foreground leading-none">
              {otherUser?.alias || 'Anonymous'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {mode === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
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
                onClick={() => addEmoji(emoji)}
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
    </div>
  );
};

export default ChatPage;
