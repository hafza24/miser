import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useMode } from '@/contexts/ModeContext';

interface MoodRoom {
  id: string;
  mood_key: string;
  name: string;
  description: string | null;
  emoji: string;
  mode: 'light' | 'dark';
  chat_id: string | null;
  chat_expires_at: string | null;
  participant_count: number;
  joined: boolean;
}

const fmtCountdown = (_iso: string | null) => 'Always open';

export default function MoodRoomsPage() {
  const { mode } = useMode();
  const [rooms, setRooms] = useState<MoodRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [, tick] = useState(0);
  const navigate = useNavigate();

  const load = async () => {
    const { data, error } = await supabase.rpc('list_mood_rooms');
    if (error) toast.error(error.message);
    else setRooms((data as MoodRoom[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => { clearInterval(iv); clearInterval(t); };
  }, []);

  const join = async (room: MoodRoom) => {
    setJoining(room.id);
    const { data, error } = await supabase.rpc('join_mood_room', { p_room_id: room.id });
    setJoining(null);
    if (error) { toast.error(error.message); return; }
    if (data) navigate(`/chat/${data}`);
  };

  const filtered = rooms.filter((r) => r.mode === mode);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Mood Rooms"
          description="Drop-in group rooms that reset every night. No invites, no waiting."
        />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No rooms available in {mode} mode right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((room) => (
              <Card key={room.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center text-5xl">
                  {room.emoji}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-foreground">{room.name}</h3>
                      {room.joined && <Badge variant="secondary" className="text-[10px]">Joined</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{room.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {room.participant_count} inside
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtCountdown(room.chat_expires_at)}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => join(room)}
                    disabled={joining === room.id}
                  >
                    {joining === room.id ? <Loader2 className="h-4 w-4 animate-spin" /> : room.joined ? 'Re-enter room' : 'Enter room'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
