import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, AlertTriangle, MessagesSquare } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    suspendedUsers: 0,
    totalChats: 0,
    activeChats: 0,
    totalMessages: 0,
    moderationActions: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [users, online, suspended, chats, activeChats, messages, modLogs, activeSubs, pendingPay] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
        supabase.from('chats').select('id', { count: 'exact', head: true }),
        supabase.from('chats').select('id', { count: 'exact', head: true }).eq('timer_stopped', false).gte('expires_at', new Date().toISOString()),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('moderation_logs').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalUsers: users.count ?? 0,
        onlineUsers: online.count ?? 0,
        suspendedUsers: suspended.count ?? 0,
        totalChats: chats.count ?? 0,
        activeChats: activeChats.count ?? 0,
        totalMessages: messages.count ?? 0,
        moderationActions: modLogs.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
    { title: 'Online Now', value: stats.onlineUsers, icon: Users, color: 'text-green-500' },
    { title: 'Suspended', value: stats.suspendedUsers, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Total Chats', value: stats.totalChats, icon: MessagesSquare, color: 'text-primary' },
    { title: 'Active Chats', value: stats.activeChats, icon: MessagesSquare, color: 'text-green-500' },
    { title: 'Total Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-muted-foreground' },
    { title: 'Moderation Actions', value: stats.moderationActions, icon: AlertTriangle, color: 'text-amber-500' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold text-foreground">Dashboard Overview</h2>

        {loading ? (
          <p className="text-muted-foreground">Loading stats...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
