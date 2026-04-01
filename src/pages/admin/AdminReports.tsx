import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Users, CreditCard, TrendingUp, Clock } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(142 76% 36%)', 'hsl(0 84% 60%)', 'hsl(48 96% 53%)'];

const AdminReports = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    pendingPayments: 0,
    totalRevenue: 0,
    approvedPayments: 0,
  });
  const [subsByPlan, setSubsByPlan] = useState<any[]>([]);
  const [revenueByMethod, setRevenueByMethod] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      let dateFilter = new Date();
      if (period === 'daily') dateFilter.setDate(dateFilter.getDate() - 1);
      else if (period === 'weekly') dateFilter.setDate(dateFilter.getDate() - 7);
      else dateFilter.setMonth(dateFilter.getMonth() - 1);
      const cutoff = dateFilter.toISOString();

      const [users, activeSubs, expiredSubs, pendingPay, allPayments, plans] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('amount, method, status, created_at').eq('status', 'approved').gte('created_at', cutoff),
        supabase.from('subscriptions').select('plan_id, status'),
      ]);

      const approvedPayments = allPayments.data || [];
      const totalRevenue = approvedPayments.reduce((sum: number, p: any) => sum + (parseFloat(String(p.amount)) || 0), 0);

      // Group revenue by method
      const methodMap: Record<string, number> = {};
      for (const p of approvedPayments) {
        methodMap[p.method] = (methodMap[p.method] || 0) + (parseFloat(p.amount) || 0);
      }
      setRevenueByMethod(Object.entries(methodMap).map(([name, value]) => ({ name, value: +value.toFixed(2) })));

      // Group subs by plan
      if (plans.data) {
        const { data: planData } = await supabase.from('subscription_plans').select('id, name');
        const planMap: Record<string, { active: number; expired: number; pending: number }> = {};
        for (const s of plans.data as any[]) {
          if (!planMap[s.plan_id]) planMap[s.plan_id] = { active: 0, expired: 0, pending: 0 };
          if (s.status === 'active') planMap[s.plan_id].active++;
          else if (s.status === 'expired') planMap[s.plan_id].expired++;
          else if (s.status === 'pending') planMap[s.plan_id].pending++;
        }
        setSubsByPlan(Object.entries(planMap).map(([planId, counts]) => ({
          name: planData?.find((p: any) => p.id === planId)?.name || 'Unknown',
          ...counts,
        })));
      }

      setStats({
        totalUsers: users.count ?? 0,
        activeSubscriptions: activeSubs.count ?? 0,
        expiredSubscriptions: expiredSubs.count ?? 0,
        pendingPayments: pendingPay.count ?? 0,
        totalRevenue: +totalRevenue.toFixed(2),
        approvedPayments: approvedPayments.length,
      });
      setLoading(false);
    };
    load();
  }, [period]);

  const exportCSV = async () => {
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!payments?.length) { toast.info('No data to export'); return; }

    const headers = ['ID', 'User ID', 'Amount', 'Method', 'Transaction ID', 'Status', 'Created At'];
    const rows = payments.map((p: any) => [p.id, p.user_id, p.amount, p.method, p.transaction_id || '', p.status, p.created_at]);
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
    { title: 'Active Subs', value: stats.activeSubscriptions, icon: TrendingUp, color: 'text-green-500' },
    { title: 'Expired Subs', value: stats.expiredSubscriptions, icon: Clock, color: 'text-destructive' },
    { title: 'Pending Payments', value: stats.pendingPayments, icon: CreditCard, color: 'text-yellow-500' },
    { title: `Revenue (${period})`, value: `$${stats.totalRevenue}`, icon: TrendingUp, color: 'text-green-500' },
    { title: 'Approved Payments', value: stats.approvedPayments, icon: CreditCard, color: 'text-primary' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading text-2xl font-bold text-foreground">Reports</h2>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {loading ? <p className="text-muted-foreground">Loading...</p> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {statCards.map((card) => (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              {subsByPlan.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Subscriptions by Plan</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={subsByPlan}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="active" fill="hsl(142 76% 36%)" name="Active" />
                        <Bar dataKey="pending" fill="hsl(48 96% 53%)" name="Pending" />
                        <Bar dataKey="expired" fill="hsl(0 84% 60%)" name="Expired" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {revenueByMethod.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Revenue by Method ({period})</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={revenueByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: $${value}`}>
                          {revenueByMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
