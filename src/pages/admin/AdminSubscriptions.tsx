import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Clock, ExternalLink, Plus, Trash2, Edit, Save, X,
  CreditCard, Crown, RefreshCw, Calendar,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ── Plan Management ──
const PlansTab = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const defaultForm = {
    name: '', description: '', price_monthly: 0, price_yearly: 0,
    daily_chat_limit: 3, daily_scene_limit: 10, daily_group_limit: 1,
    dark_mode_access: false, group_requests_access: false,
    presence_access: false, auto_translate_access: false,
    is_active: true, sort_order: 0,
  };
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('subscription_plans').select('*').order('sort_order');
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditPlan(null);
    setForm({ ...defaultForm, sort_order: plans.length });
    setShowForm(true);
  };

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setForm({
      name: plan.name, description: plan.description || '',
      price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
      daily_chat_limit: plan.daily_chat_limit ?? 3,
      daily_scene_limit: plan.daily_scene_limit ?? 0,
      daily_group_limit: plan.daily_group_limit ?? 0,
      dark_mode_access: !!plan.dark_mode_access,
      group_requests_access: !!plan.group_requests_access,
      presence_access: !!plan.presence_access,
      auto_translate_access: !!plan.auto_translate_access,
      is_active: plan.is_active, sort_order: plan.sort_order,
    });
    setShowForm(true);
  };

  const savePlan = async () => {
    if (!form.name.trim()) { toast.error('Plan name required'); return; }
    if (editPlan) {
      const { error } = await supabase.from('subscription_plans').update(form as any).eq('id', editPlan.id);
      if (error) { toast.error('Failed: ' + error.message); return; }
      toast.success('Plan updated');
    } else {
      const { error } = await supabase.from('subscription_plans').insert(form as any);
      if (error) { toast.error('Failed: ' + error.message); return; }
      toast.success('Plan created');
    }
    setShowForm(false);
    load();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (error) toast.error('Failed: ' + error.message);
    else { toast.success('Plan deleted'); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Plans</h3>
        <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Plan</Button>
      </div>

      {loading ? <p className="text-muted-foreground">Loading...</p> : plans.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">No plans created yet.</p>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    <Badge variant={plan.is_active ? 'default' : 'outline'}>{plan.is_active ? 'Active' : 'Disabled'}</Badge>
                    {plan.dark_mode_access && <Badge variant="outline">🌑 Dark</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${plan.price_monthly}/mo · ${plan.price_yearly}/yr · {plan.daily_chat_limit} chats · {plan.daily_scene_limit} scenes
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deletePlan(plan.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Monthly Price ($)</Label><Input type="number" step="0.01" value={form.price_monthly} onChange={e => setForm({...form, price_monthly: +e.target.value})} /></div>
              <div><Label>Yearly Price ($)</Label><Input type="number" step="0.01" value={form.price_yearly} onChange={e => setForm({...form, price_yearly: +e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Daily Chat Limit</Label><Input type="number" value={form.daily_chat_limit} onChange={e => setForm({...form, daily_chat_limit: +e.target.value})} /></div>
              <div><Label>Daily Scene Limit</Label><Input type="number" value={form.daily_scene_limit} onChange={e => setForm({...form, daily_scene_limit: +e.target.value})} /></div>
            </div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: +e.target.value})} /></div>
            <div className="flex items-center justify-between">
              <Label>Dark Mode Access</Label>
              <Switch checked={form.dark_mode_access} onCheckedChange={v => setForm({...form, dark_mode_access: v})} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={savePlan}><Save className="h-4 w-4 mr-1" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Subscriptions & Payments Tab ──
const SubscriptionsTab = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('pending');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const planIds = [...new Set(data.map((s: any) => s.plan_id))];
      const [profiles, plans, payments] = await Promise.all([
        supabase.from('profiles').select('user_id, alias, emoji_avatar, email').in('user_id', userIds),
        supabase.from('subscription_plans').select('*').in('id', planIds),
        supabase.from('payments').select('*').in('subscription_id', data.map((s: any) => s.id)).order('created_at', { ascending: false }),
      ]);

      const enriched = await Promise.all(data.map(async (s: any) => {
        const prof = profiles.data?.find((p: any) => p.user_id === s.user_id);
        const plan = plans.data?.find((p: any) => p.id === s.plan_id);
        const payment = payments.data?.find((p: any) => p.subscription_id === s.id);
        let signedUrl: string | null = null;
        if (payment?.proof_url && !payment.proof_url.startsWith('http')) {
          const { data: sd } = await supabase.storage.from('payment-screenshots').createSignedUrl(payment.proof_url, 3600);
          signedUrl = sd?.signedUrl || null;
        }
        return { ...s, profile: prof, plan, payment, signedUrl };
      }));
      setSubs(enriched);
    } else {
      setSubs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleAction = async (sub: any, action: 'active' | 'expired' | 'cancelled') => {
    setUpdating(sub.id);
    try {
      const { error } = await supabase.from('subscriptions').update({ status: action } as any).eq('id', sub.id);
      if (error) throw error;

      if (sub.payment) {
        await supabase.from('payments').update({
          status: action === 'active' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
        } as any).eq('id', sub.payment.id);
      }

      if (action === 'active' && sub.plan?.dark_mode_access) {
        await supabase.from('profiles').update({ dark_mode_blocked: false, payment_status: 'approved' } as any).eq('user_id', sub.user_id);
      }

      toast.success(`Subscription ${action}`);
      load();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
    setUpdating(null);
  };

  const extendSub = async (sub: any, days: number) => {
    setUpdating(sub.id);
    const newExpiry = new Date(sub.expiry_date);
    newExpiry.setDate(newExpiry.getDate() + days);
    const { error } = await supabase.from('subscriptions').update({
      expiry_date: newExpiry.toISOString(),
      status: 'active',
    } as any).eq('id', sub.id);
    if (error) toast.error('Failed');
    else { toast.success(`Extended by ${days} days`); load(); }
    setUpdating(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Active</Badge>;
      case 'pending': return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'expired': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'active', 'expired', 'all'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Loading...</p> : subs.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">No {filter !== 'all' ? filter : ''} subscriptions</p>
      ) : (
        <div className="space-y-3">
          {subs.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{sub.profile?.emoji_avatar || '💫'}</span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{sub.profile?.alias || 'Unknown'}</span>
                        {statusBadge(sub.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">{sub.profile?.email || 'No email'}</p>
                      <p className="text-sm text-foreground"><span className="text-muted-foreground">Plan:</span> {sub.plan?.name || 'Unknown'}</p>
                      <p className="text-sm text-foreground"><span className="text-muted-foreground">Period:</span> {sub.billing_period}</p>
                      <p className="text-sm text-foreground"><span className="text-muted-foreground">Expiry:</span> {new Date(sub.expiry_date).toLocaleDateString()}</p>
                      {sub.payment && (
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">Amount:</span> ${sub.payment.amount} via {sub.payment.method}
                          {sub.payment.transaction_id && ` (${sub.payment.transaction_id})`}
                        </p>
                      )}
                    </div>
                  </div>

                  {sub.signedUrl && (
                    <a href={sub.signedUrl} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                      <div className="w-28 h-20 rounded-lg border border-border overflow-hidden bg-muted relative group">
                        <img src={sub.signedUrl} alt="Payment proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </a>
                  )}

                  <div className="flex sm:flex-col gap-2 flex-shrink-0 flex-wrap">
                    {sub.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => handleAction(sub, 'active')} disabled={updating === sub.id} className="gap-1 bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleAction(sub, 'expired')} disabled={updating === sub.id} className="gap-1">
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                    {(sub.status === 'active' || sub.status === 'expired') && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => extendSub(sub, 30)} disabled={updating === sub.id} className="gap-1">
                          <Calendar className="h-4 w-4" /> +30 days
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => extendSub(sub, 365)} disabled={updating === sub.id} className="gap-1">
                          <Calendar className="h-4 w-4" /> +1 year
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──
const AdminSubscriptions = () => {
  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">Subscriptions</h2>
        <Tabs defaultValue="subscriptions">
          <TabsList>
            <TabsTrigger value="subscriptions">Subscriptions & Payments</TabsTrigger>
            <TabsTrigger value="plans">Manage Plans</TabsTrigger>
          </TabsList>
          <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
          <TabsContent value="plans"><PlansTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
