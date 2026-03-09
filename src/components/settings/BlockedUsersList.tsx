import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Ban, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface BlockedUser {
  id: string;
  blocked_id: string;
  created_at: string;
  alias: string;
  emoji_avatar: string;
}

const BlockedUsersList = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlocked = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const blockedIds = data.map(b => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar')
        .in('user_id', blockedIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      setBlockedUsers(data.map(b => ({
        ...b,
        alias: profileMap.get(b.blocked_id)?.alias ?? 'Unknown',
        emoji_avatar: profileMap.get(b.blocked_id)?.emoji_avatar ?? '👤',
      })));
    } else {
      setBlockedUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBlocked();
  }, [user]);

  const handleUnblock = async (blockId: string, alias: string) => {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('id', blockId);

    if (error) {
      toast.error('Failed to unblock user');
      return;
    }
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
    toast.success(`${alias} has been unblocked`);
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-card space-y-4">
      <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
        <Ban className="h-5 w-5" />
        Blocked Users
      </h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : blockedUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
      ) : (
        <ul className="space-y-3">
          {blockedUsers.map(bu => (
            <li key={bu.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{bu.emoji_avatar}</span>
                <span className="text-sm font-medium text-foreground">{bu.alias}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnblock(bu.id, bu.alias)}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <UserX className="h-4 w-4 mr-1" />
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BlockedUsersList;
