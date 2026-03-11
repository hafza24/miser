import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle, Minus, Plus, Sun, Moon } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  alias: string;
  emoji_avatar: string;
  email: string | null;
  gender: string | null;
  is_online: boolean;
  is_suspended: boolean;
  violation_count: number;
  daily_scene_limit: number;
  daily_chat_limit: number;
  created_at: string;
  mode_preference: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, user_id, alias, emoji_avatar, email, gender, is_online, is_suspended, violation_count, daily_scene_limit, daily_chat_limit, created_at, mode_preference')
      .order('created_at', { ascending: false })
      .limit(100);

    if (search.trim()) {
      query = query.or(`alias.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) toast.error('Failed to load users');
    setUsers((data as UserProfile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const toggleSuspend = async (user: UserProfile) => {
    setUpdating(user.id);
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: !user.is_suspended })
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to update user');
    } else {
      toast.success(user.is_suspended ? 'User unsuspended' : 'User suspended');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    }
    setUpdating(null);
  };

  const updateLimit = async (userId: string, field: 'daily_scene_limit' | 'daily_chat_limit', delta: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newValue = Math.max(0, Math.min(100, user[field] + delta));
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update limit');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: newValue } : u));
    }
    setUpdating(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">User Management</h2>
          <Badge variant="outline">{users.length} users</Badge>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by alias or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {loading ? (
          <p className="text-muted-foreground">Loading users...</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* User info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl">{user.emoji_avatar}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-semibold text-foreground truncate">{user.alias}</span>
                          {user.is_online && <Badge variant="default" className="text-[10px] px-1.5 py-0">Online</Badge>}
                          {user.is_suspended && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{user.mode_preference}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email || 'No email'}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.gender || 'No gender'} · Violations: {user.violation_count} · Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Scenes/day</p>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateLimit(user.id, 'daily_scene_limit', -1)} disabled={updating === user.id}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center text-foreground">{user.daily_scene_limit}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateLimit(user.id, 'daily_scene_limit', 1)} disabled={updating === user.id}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Chats/day</p>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateLimit(user.id, 'daily_chat_limit', -1)} disabled={updating === user.id}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center text-foreground">{user.daily_chat_limit}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateLimit(user.id, 'daily_chat_limit', 1)} disabled={updating === user.id}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Suspend toggle */}
                    <Button
                      variant={user.is_suspended ? 'default' : 'destructive'}
                      size="sm"
                      onClick={() => toggleSuspend(user)}
                      disabled={updating === user.id}
                      className="flex-shrink-0"
                    >
                      {user.is_suspended ? (
                        <><CheckCircle className="h-4 w-4 mr-1" /> Unsuspend</>
                      ) : (
                        <><Ban className="h-4 w-4 mr-1" /> Suspend</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
