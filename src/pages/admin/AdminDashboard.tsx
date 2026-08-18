import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminTranslationSettings from './AdminTranslationSettings';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
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
        <PageHeader 
          title="Admin Dashboard" 
          description="Real-time overview of Fur&Fir's activity and safety."
          actions={
            <Badge variant="outline" className="text-xs h-9 px-3 rounded-full">
              <Clock className="h-3.5 w-3.5 mr-2" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Badge>
          }
        />

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="grid gap-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 font-medium text-sm">
                <Bell className="h-4 w-4 shrink-0" />
                {alert}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading stats...</p>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {cards.map((card) => (
                <div key={card.title} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-xl ${card.bg}`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground font-heading">
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{card.title}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              <SectionCard title="Revenue Trend" description="Last 7 days" className="md:col-span-1">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip cursor={{fill: 'hsl(var(--primary)/0.05)'}} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="User Growth" description="New signups" className="md:col-span-1">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }} />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>
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
