import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface ChatRow {
  id: string;
  mode: string;
  is_group: boolean;
  timer_stopped: boolean;
  expires_at: string | null;
  created_at: string;
  participants: { alias: string; emoji_avatar: string }[];
  messageCount: number;
}

const AdminChats = () => {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: chatData, error } = await supabase
        .from('chats')
        .select('id, mode, is_group, timer_stopped, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        toast.error('Failed to load chats');
        setLoading(false);
        return;
      }

      const chatIds = (chatData ?? []).map(c => c.id);
      if (chatIds.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Load participants
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id')
        .in('chat_id', chatIds);

      const userIds = [...new Set((participants ?? []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar')
        .in('user_id', userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      // Count messages per chat
      const messageCounts = new Map<string, number>();
      for (const chatId of chatIds) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('chat_id', chatId);
        messageCounts.set(chatId, count ?? 0);
      }

      setChats((chatData ?? []).map(chat => {
        const chatParticipants = (participants ?? [])
          .filter(p => p.chat_id === chat.id)
          .map(p => profileMap.get(p.user_id))
          .filter(Boolean) as { alias: string; emoji_avatar: string }[];

        return {
          ...chat,
          participants: chatParticipants,
          messageCount: messageCounts.get(chat.id) ?? 0,
        };
      }));
      setLoading(false);
    };
    load();
  }, []);

  const isActive = (chat: ChatRow) => {
    if (chat.timer_stopped) return true;
    if (!chat.expires_at) return true;
    return new Date(chat.expires_at) > new Date();
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Chat Oversight</h2>
          <Badge variant="outline">{chats.length} chats</Badge>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading chats...</p>
        ) : chats.length === 0 ? (
          <p className="text-muted-foreground">No chats found.</p>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => {
              const active = isActive(chat);
              return (
                <Card key={chat.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex -space-x-1">
                          {chat.participants.map((p, i) => (
                            <span key={i} className="text-lg">{p.emoji_avatar}</span>
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {chat.participants.map(p => p.alias).join(' & ') || 'No participants'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {chat.messageCount} messages · {new Date(chat.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={active ? 'default' : 'secondary'} className="text-[10px]">
                          {active ? 'Active' : 'Expired'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{chat.mode}</Badge>
                        {chat.timer_stopped && (
                          <Badge variant="outline" className="text-[10px]">Permanent</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminChats;
