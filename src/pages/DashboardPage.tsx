import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Users, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ChatItem {
  id: string;
  mode: string;
  is_group: boolean;
  created_at: string;
  last_message?: string;
  participants: { alias: string; emoji_avatar: string }[];
}

const DashboardPage = () => {
  const { user, profile } = useAuth();
  const { mode } = useMode();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadChats();
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setLoading(false);
      return;
    }

    const chatIds = participations.map(p => p.chat_id);
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('created_at', { ascending: false });

    if (chatData) {
      const enriched = await Promise.all(
        chatData.map(async (chat) => {
          const { data: parts } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', chat.id);

          const otherUserIds = (parts || [])
            .map(p => p.user_id)
            .filter(id => id !== user.id);

          let participants: { alias: string; emoji_avatar: string }[] = [];
          if (otherUserIds.length) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('alias, emoji_avatar')
              .in('user_id', otherUserIds);
            participants = profiles || [];
          }

          const { data: msgs } = await supabase
            .from('messages')
            .select('content')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...chat,
            participants,
            last_message: msgs?.[0]?.content,
          };
        })
      );
      setChats(enriched);
    }
    setLoading(false);
  };

  const startNewChat = async () => {
    // For the prototype, create a solo chat placeholder
    toast.info('Looking for someone to connect with...');
    // In production, this would match with another user
  };

  return (
    <AppLayout>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {mode === 'light' ? '🌞 Light Space' : '🌑 Dark Space'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'light' ? 'Emotional connections' : '18+ connections'}
            </p>
          </div>
          <Button onClick={startNewChat} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Mood chips for light mode */}
        {mode === 'light' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['💛 Emotional Support', '🤝 Friendship', '💕 Cute Love'].map(mood => (
              <button
                key={mood}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {mood}
              </button>
            ))}
          </div>
        )}

        {/* Dark mode categories */}
        {mode === 'dark' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['💋 Flirting', '🔥 Passionate Romance', '✨ Fantasy Roleplay'].map(cat => (
              <button
                key={cat}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors neon-glow"
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Chat list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Loading chats...
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{mode === 'light' ? '🌸' : '🌙'}</div>
            <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
              No conversations yet
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Start a new chat to connect anonymously
            </p>
            <Button onClick={startNewChat} className="gap-2">
              <Plus className="h-4 w-4" />
              Start Chatting
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted transition-colors text-left shadow-card"
              >
                <div className="text-2xl">
                  {chat.participants[0]?.emoji_avatar || '💬'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {chat.participants.map(p => p.alias).join(', ') || 'Anonymous'}
                    </span>
                    {chat.is_group && <Users className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message || 'No messages yet'}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
