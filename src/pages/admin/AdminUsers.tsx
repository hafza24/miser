import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle, Minus, Plus, Sun, Moon, Trash2, Settings2 } from 'lucide-react';
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
  daily_group_limit: number;
  max_group_members: number;
  created_at: string;
  mode_preference: string;
  light_mode_blocked: boolean;
  dark_mode_blocked: boolean;
  plan_name?: string | null;
  plan_status?: string | null;
  plan_expiry?: string | null;
}

type LimitField = 'daily_scene_limit' | 'daily_chat_limit' | 'daily_group_limit' | 'max_group_members';

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, user_id, alias, emoji_avatar, email, gender, is_online, is_suspended, violation_count, daily_scene_limit, daily_chat_limit, daily_group_limit, max_group_members, created_at, mode_preference, light_mode_blocked, dark_mode_blocked')
      .order('created_at', { ascending: false })
      .limit(100);

    if (search.trim()) {
      query = query.or(`alias.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) toast.error('Failed to load users');
    const profiles = (data as UserProfile[]) ?? [];

    if (profiles.length > 0) {
      const userIds = profiles.map(p => p.user_id);
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id, status, expiry_date, plan_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });
      const planIds = [...new Set((subs || []).map((s: any) => s.plan_id))];
      const { data: plans } = planIds.length
        ? await supabase.from('subscription_plans').select('id, name').in('id', planIds)
        : { data: [] as any[] };
      const latestByUser = new Map<string, any>();
      (subs || []).forEach((s: any) => { if (!latestByUser.has(s.user_id)) latestByUser.set(s.user_id, s); });
      profiles.forEach(p => {
        const s = latestByUser.get(p.user_id);
        if (s) {
          const plan = (plans as any[])?.find(pl => pl.id === s.plan_id);
          p.plan_name = plan?.name || 'Unknown';
          p.plan_status = s.status;
          p.plan_expiry = s.expiry_date;
        } else {
          p.plan_name = 'Free';
          p.plan_status = null;
          p.plan_expiry = null;
        }
      });
    }

    setUsers(profiles);
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

  const updateLimit = async (userId: string, field: LimitField, delta: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const max = field === 'max_group_members' ? 50 : 100;
    const min = field === 'max_group_members' ? 2 : 0;
    const newValue = Math.max(min, Math.min(max, (user[field] ?? 0) + delta));
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue } as any)
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update limit');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: newValue } : u));
    }
    setUpdating(null);
  };

  const toggleMode = async (user: UserProfile, field: 'light_mode_blocked' | 'dark_mode_blocked') => {
    setUpdating(user.id);
    const { error } = await supabase.from('profiles').update({ [field]: !user[field] } as any).eq('id', user.id);
    if (error) { toast.error('Failed to update'); } else {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, [field]: !u[field] } : u));
      toast.success('Updated');
    }
    setUpdating(null);
  };

  const handleAdminDelete = async (user: UserProfile) => {
    setUpdating(user.id);
    const { error } = await supabase
      .from('profiles')
      .update({ scheduled_deletion_at: new Date().toISOString() } as any)
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to schedule deletion');
    } else {
      toast.success(`${user.alias}'s account scheduled for deletion`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    }
    setUpdating(null);
  };

  const CounterRow = ({ label, value, onDec, onInc, disabled }: { label: string; value: number; onDec: () => void; onInc: () => void; disabled?: boolean }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={onDec} disabled={disabled}><Minus className="h-3 w-3" /></Button>
        <span className="text-sm font-medium w-8 text-center text-foreground">{value ?? 0}</span>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={onInc} disabled={disabled}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  );

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
                          <Badge
                            variant={user.plan_status === 'active' ? 'default' : 'outline'}
                            className="text-[10px] px-1.5 py-0"
                            title={user.plan_expiry ? `Expires ${new Date(user.plan_expiry).toLocaleDateString()}` : 'No active subscription'}
                          >
                            💎 {user.plan_name || 'Free'}{user.plan_status && user.plan_status !== 'active' ? ` (${user.plan_status})` : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email || 'No email'}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.gender || 'No gender'} · Violations: {user.violation_count} · Joined: {new Date(user.created_at).toLocaleDateString()}
                          {user.plan_expiry && user.plan_status === 'active' && ` · Plan expires: ${new Date(user.plan_expiry).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    {/* Limits dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0 gap-1">
                          <Settings2 className="h-4 w-4" /> Limits & Access
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Limits</p>
                        <CounterRow label="Chats/day" value={user.daily_chat_limit}
                          onDec={() => updateLimit(user.id, 'daily_chat_limit', -1)}
                          onInc={() => updateLimit(user.id, 'daily_chat_limit', 1)}
                          disabled={updating === user.id} />
                        <CounterRow label="Scenes/day" value={user.daily_scene_limit}
                          onDec={() => updateLimit(user.id, 'daily_scene_limit', -1)}
                          onInc={() => updateLimit(user.id, 'daily_scene_limit', 1)}
                          disabled={updating === user.id} />
                        <CounterRow label="Groups/day" value={user.daily_group_limit}
                          onDec={() => updateLimit(user.id, 'daily_group_limit', -1)}
                          onInc={() => updateLimit(user.id, 'daily_group_limit', 1)}
                          disabled={updating === user.id} />
                        <div className="pt-2 border-t">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Members Restriction</p>
                          <CounterRow label="Max members / group" value={user.max_group_members}
                            onDec={() => updateLimit(user.id, 'max_group_members', -1)}
                            onInc={() => updateLimit(user.id, 'max_group_members', 1)}
                            disabled={updating === user.id} />
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mode Access</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Light mode</span>
                            <Button size="sm" variant={user.light_mode_blocked ? 'destructive' : 'outline'} className="gap-1" disabled={updating === user.id}
                              onClick={() => toggleMode(user, 'light_mode_blocked')}>
                              <Sun className="h-3.5 w-3.5" /> {user.light_mode_blocked ? 'Blocked' : 'Allowed'}
                            </Button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-foreground">Dark mode</span>
                            <Button size="sm" variant={user.dark_mode_blocked ? 'destructive' : 'outline'} className="gap-1" disabled={updating === user.id}
                              onClick={() => toggleMode(user, 'dark_mode_blocked')}>
                              <Moon className="h-3.5 w-3.5" /> {user.dark_mode_blocked ? 'Blocked' : 'Allowed'}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

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

                    {/* Delete account */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={updating === user.id}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {user.alias}'s account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this user's account and all their data. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleAdminDelete(user)}>Delete Account</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
