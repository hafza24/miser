import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminTranslationSettings from './AdminTranslationSettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, AlertTriangle, MessagesSquare, CreditCard, Crown, TrendingUp, Clock, Bell, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

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
    totalRevenue: 0,
    todaySignups: 0,
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [users, online, suspended, chats, activeChats, messages, modLogs, activeSubs, pendingPay, revenue, todayUsers, recentPayments, recentProfiles] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
        supabase.from('chats').select('id', { count: 'exact', head: true }),
        supabase.from('chats').select('id', { count: 'exact', head: true }).eq('timer_stopped', false).gte('expires_at', new Date().toISOString()),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('moderation_logs').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('amount').eq('status', 'approved'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('payments').select('amount, created_at, status').eq('status', 'approved').order('created_at', { ascending: true }).limit(500),
        supabase.from('profiles').select('created_at').order('created_at', { ascending: true }).limit(1000),
      ]);

      const totalRevenue = (revenue.data || []).reduce((sum: number, p: any) => sum + (parseFloat(String(p.amount)) || 0), 0);

      // Build revenue chart data (last 7 days)
      const revMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        revMap[d.toISOString().split('T')[0]] = 0;
      }
      for (const p of (recentPayments.data || []) as any[]) {
        const day = p.created_at?.split('T')[0];
        if (day && revMap[day] !== undefined) {
          revMap[day] += parseFloat(String(p.amount)) || 0;
        }
      }
      setRevenueData(Object.entries(revMap).map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        revenue: +amount.toFixed(2),
      })));

      // Build user growth (last 7 days)
      const growthMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        growthMap[d.toISOString().split('T')[0]] = 0;
      }
      for (const p of (recentProfiles.data || []) as any[]) {
        const day = p.created_at?.split('T')[0];
        if (day && growthMap[day] !== undefined) {
          growthMap[day]++;
        }
      }
      setUserGrowth(Object.entries(growthMap).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        users: count,
      })));

      // Generate alerts
      const newAlerts: string[] = [];
      if ((pendingPay.count ?? 0) > 0) newAlerts.push(`🔔 ${pendingPay.count} pending payment(s) need review`);
      if ((suspended.count ?? 0) > 0) newAlerts.push(`⚠️ ${suspended.count} suspended user(s)`);
      if ((online.count ?? 0) === 0) newAlerts.push(`📉 No users currently online`);
      const pendingTickets = await supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open');
      if ((pendingTickets.count ?? 0) > 0) newAlerts.push(`🎫 ${pendingTickets.count} open support ticket(s)`);
      setAlerts(newAlerts);

      setStats({
        totalUsers: users.count ?? 0,
        onlineUsers: online.count ?? 0,
        suspendedUsers: suspended.count ?? 0,
        totalChats: chats.count ?? 0,
        activeChats: activeChats.count ?? 0,
        totalMessages: messages.count ?? 0,
        moderationActions: modLogs.count ?? 0,
        activeSubscriptions: activeSubs.count ?? 0,
        pendingPayments: pendingPay.count ?? 0,
        totalRevenue: +totalRevenue.toFixed(2),
        todaySignups: todayUsers.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Online Now', value: stats.onlineUsers, icon: Users, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Today Signups', value: stats.todaySignups, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Total Revenue', value: `Rs ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-600/10' },
    { title: 'Active Subs', value: stats.activeSubscriptions, icon: Crown, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Pending Payments', value: stats.pendingPayments, icon: CreditCard, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { title: 'Active Chats', value: stats.activeChats, icon: MessagesSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Total Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Suspended', value: stats.suspendedUsers, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { title: 'Mod Actions', value: stats.moderationActions, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm text-foreground">Alerts</h3>
              </div>
              <div className="space-y-1">
                {alerts.map((alert, i) => (
                  <p key={i} className="text-sm text-foreground">{alert}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading stats...</p>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {cards.map((card) => (
                <Card key={card.title} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${card.bg}`}>
                        <card.icon className={`h-4 w-4 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Revenue (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> New Users (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                      <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <div className="mt-6">
              <AdminTranslationSettings />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
