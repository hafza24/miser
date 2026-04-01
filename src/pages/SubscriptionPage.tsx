import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Crown, Upload, CheckCircle, Clock, XCircle, Lock, Star, Zap, Moon } from 'lucide-react';
import { toast } from 'sonner';

const SubscriptionPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { subscription, plans, loading, isActive, hasDarkModeAccess, daysLeft, isExpiringSoon } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [name, setName] = useState('');
  const [method, setMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPlan || !name.trim() || !method || !screenshot) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Upload screenshot
      const fileExt = screenshot.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, screenshot);
      if (uploadError) throw uploadError;

      const price = billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly;
      const expiryDate = new Date();
      if (billingPeriod === 'monthly') {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      } else {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }

      // Create subscription (pending)
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          start_date: new Date().toISOString(),
          expiry_date: expiryDate.toISOString(),
          status: 'pending',
          billing_period: billingPeriod,
        } as any)
        .select()
        .single();

      if (subError) throw subError;

      // Create payment record
      const { error: payError } = await supabase.from('payments').insert({
        user_id: user.id,
        subscription_id: (subData as any).id,
        amount: price,
        method,
        transaction_id: transactionId.trim() || null,
        proof_url: filePath,
        status: 'pending',
      } as any);

      if (payError) throw payError;

      toast.success('Payment submitted! We will review it shortly.');
      setShowForm(false);
      setSelectedPlan(null);
      setName('');
      setMethod('');
      setTransactionId('');
      setScreenshot(null);
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  const pendingSub = subscription?.status === 'pending';
  const planIcons = [Star, Zap, Crown];

  return (
    <AppLayout>
      <div className="p-4 max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Subscription Plans</h1>
          <p className="text-muted-foreground mt-2">Unlock premium features with a subscription</p>
        </div>

        {/* Current Subscription Status */}
        {subscription && (
          <Card className={`border-2 ${isActive ? 'border-green-500/30 bg-green-500/5' : pendingSub ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {isActive ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : pendingSub ? (
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">
                      {subscription.plan?.name || 'Subscription'}
                    </p>
                    <Badge variant={isActive ? 'default' : pendingSub ? 'outline' : 'destructive'} className={isActive ? 'bg-green-600' : ''}>
                      {isActive ? 'Active' : pendingSub ? 'Pending' : subscription.status === 'expired' ? 'Expired' : subscription.status}
                    </Badge>
                  </div>
                  {isActive && (
                    <>
                      <p className="text-sm text-muted-foreground mt-1">
                        Expires: {new Date(subscription.expiry_date).toLocaleDateString()} ({daysLeft} days left)
                      </p>
                      {isExpiringSoon && (
                        <p className="text-sm text-yellow-600 font-medium mt-1">⚠️ Expiring soon — renew to keep access</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">📨 {subscription.plan?.daily_chat_limit} chats/day</Badge>
                        <Badge variant="outline">🎬 {subscription.plan?.daily_scene_limit} scenes/day</Badge>
                        {subscription.plan?.dark_mode_access && <Badge variant="outline">🌑 Dark Mode</Badge>}
                      </div>
                    </>
                  )}
                  {pendingSub && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Your payment is being reviewed. Features will unlock once approved.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Period Toggle */}
        {!showForm && (
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <Switch
              checked={billingPeriod === 'yearly'}
              onCheckedChange={(v) => setBillingPeriod(v ? 'yearly' : 'monthly')}
            />
            <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Yearly <span className="text-green-500 text-xs">Save!</span>
            </span>
          </div>
        )}

        {/* Plans Grid */}
        {!showForm && plans.length > 0 && (
          <div className="space-y-3">
            {plans.map((plan, i) => {
              const Icon = planIcons[i % planIcons.length];
              const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const isCurrentPlan = isActive && subscription?.plan_id === plan.id;
              return (
                <Card key={plan.id} className={`transition-all ${isCurrentPlan ? 'border-primary border-2' : 'hover:border-primary/50'}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-heading font-bold text-foreground">{plan.name}</h3>
                          {isCurrentPlan && <Badge className="bg-primary text-primary-foreground text-xs">Current</Badge>}
                        </div>
                        {plan.description && <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>}
                        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
                          <Badge variant="outline">📨 {plan.daily_chat_limit} chats/day</Badge>
                          <Badge variant="outline">🎬 {plan.daily_scene_limit} scenes/day</Badge>
                          {plan.dark_mode_access && <Badge variant="outline">🌑 Dark Mode</Badge>}
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-2xl font-bold text-foreground">${price}</span>
                            <span className="text-sm text-muted-foreground">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                          </div>
                          <Button
                            size="sm"
                            disabled={isCurrentPlan || pendingSub}
                            onClick={() => handleSelectPlan(plan)}
                          >
                            {isCurrentPlan ? 'Current Plan' : pendingSub ? 'Pending...' : isActive ? 'Upgrade' : 'Subscribe'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {plans.length === 0 && !showForm && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No plans available yet. Check back soon!
            </CardContent>
          </Card>
        )}

        {/* Payment Details */}
        {!showForm && plans.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-2">
              <h3 className="font-heading font-semibold text-foreground">Payment Details</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Methods:</span>
                  <span className="font-medium text-foreground">JazzCash · EasyPaisa · Nayapay</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium text-foreground">03016912786</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium text-foreground">Asim Azeemi</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Form */}
        {showForm && selectedPlan && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-foreground">
                  Subscribe to {selectedPlan.name}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Amount: <span className="font-bold text-foreground">
                  ${billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly}
                </span> / {billingPeriod === 'monthly' ? 'month' : 'year'}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method *</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JazzCash">JazzCash</SelectItem>
                      <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                      <SelectItem value="Nayapay">Nayapay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="txid">Transaction ID (optional)</Label>
                  <Input id="txid" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="e.g. TXN12345678" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="screenshot">Payment Screenshot *</Label>
                  <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                    <input id="screenshot" type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} />
                    <label htmlFor="screenshot" className="cursor-pointer">
                      {screenshot ? (
                        <div className="flex items-center gap-2 justify-center text-foreground">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{screenshot.name}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload screenshot</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default SubscriptionPage;
