import React, { useState, useEffect } from 'react';
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
import { Crown, Upload, CheckCircle, Clock, XCircle, Lock, Star, Zap, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { usdToPkr, formatPkr } from '@/lib/currency';

interface PaymentInfoRow {
  id: string;
  method_name: string;
  account_number: string;
  account_holder: string;
}

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
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfoRow[]>([]);
  const [trialUsed, setTrialUsed] = useState<boolean>(true);
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    const loadPaymentInfo = async () => {
      const { data } = await supabase
        .from('payment_info')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (data) setPaymentInfo(data as any);
    };
    loadPaymentInfo();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('user_id', user.id)
        .maybeSingle();
      setTrialUsed(!!(data as any)?.trial_used);
    })();
  }, [user]);

  const premiumPlan = plans.length > 0
    ? (plans.find(p => p.name?.toLowerCase() === 'premium')
        || [...plans].reverse().find(p => p.dark_mode_access)
        || plans[plans.length - 1])
    : null;

  const canStartTrial =
    !!user &&
    !trialUsed &&
    !subscription &&
    !!premiumPlan;

  const handleStartTrial = async () => {
    if (!user || !premiumPlan) return;
    setStartingTrial(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan_id: premiumPlan.id,
        start_date: new Date().toISOString(),
        expiry_date: expiryDate.toISOString(),
        status: 'active',
        billing_period: 'trial',
      } as any);
      if (subError) throw subError;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ trial_used: true } as any)
        .eq('user_id', user.id);
      if (profErr) throw profErr;

      setTrialUsed(true);
      toast.success('🎉 Your 7-day free premium trial is active!');
    } catch (err: any) {
      toast.error('Failed to start trial: ' + (err.message || 'Unknown error'));
    }
    setStartingTrial(false);
  };

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
      const fileExt = screenshot.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, screenshot);
      if (uploadError) throw uploadError;

      const priceUsd = billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly;
      const pricePkr = usdToPkr(priceUsd);
      const expiryDate = new Date();
      if (billingPeriod === 'monthly') {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      } else {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }

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

      const { error: payError } = await supabase.from('payments').insert({
        user_id: user.id,
        subscription_id: (subData as any).id,
        amount: pricePkr,
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
      <div className="p-4 max-w-5xl mx-auto space-y-6 animate-fade-in">
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

        {/* Free Trial Banner */}
        {!showForm && canStartTrial && (
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-bold text-foreground text-lg">
                      7-Day Free Premium Trial
                    </h3>
                    <Badge className="bg-primary text-primary-foreground">Free</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unlock all <strong className="text-foreground">{premiumPlan?.name}</strong> features for one week — no payment required. One trial per account.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={handleStartTrial}
                  disabled={startingTrial}
                >
                  <Star className="h-4 w-4" />
                  {startingTrial ? 'Starting...' : 'Start Free Trial'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trial Used Notice */}
        {!showForm && trialUsed && !subscription && (
          <p className="text-center text-xs text-muted-foreground">
            You've already used your free trial. Choose a plan below to continue with premium.
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {plans.map((plan, i) => {
              const Icon = planIcons[i % planIcons.length];
              const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const isCurrentPlan = isActive && subscription?.plan_id === plan.id;
              const monthlyEquivalent = billingPeriod === 'yearly' && plan.price_yearly > 0
                ? (plan.price_yearly / 12)
                : null;
              const yearlyIfMonthly = plan.price_monthly * 12;
              const yearlySavings = plan.price_yearly > 0 && yearlyIfMonthly > 0
                ? Math.max(0, yearlyIfMonthly - plan.price_yearly)
                : 0;
              const savingsPct = yearlyIfMonthly > 0
                ? Math.round((yearlySavings / yearlyIfMonthly) * 100)
                : 0;
              const isPopular = i === 1 && plans.length >= 2;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col transition-all ${
                    isCurrentPlan
                      ? 'border-primary border-2'
                      : isPopular
                        ? 'border-primary/60 border-2 shadow-lg'
                        : 'hover:border-primary/50'
                  }`}
                >
                  {isPopular && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground shadow">Most Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading font-bold text-foreground text-lg">{plan.name}</h3>
                          {isCurrentPlan && <Badge className="bg-primary text-primary-foreground text-xs">Current</Badge>}
                        </div>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">${price}</span>
                        <span className="text-sm text-muted-foreground">
                          /{billingPeriod === 'monthly' ? 'month' : 'year'}
                        </span>
                      </div>
                      {billingPeriod === 'yearly' && monthlyEquivalent !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ≈ ${monthlyEquivalent.toFixed(2)}/mo billed yearly
                        </p>
                      )}
                      {billingPeriod === 'yearly' && yearlySavings > 0 && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5">
                          <Badge className="bg-green-500/15 text-green-600 border-green-500/30 border hover:bg-green-500/15">
                            Save ${yearlySavings.toFixed(0)} ({savingsPct}% off)
                          </Badge>
                        </div>
                      )}
                      {billingPeriod === 'monthly' && plan.price_yearly > 0 && savingsPct > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Switch to yearly and save {savingsPct}%
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-5 text-sm flex-1">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>{plan.daily_chat_limit}</strong> chats per day
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>{plan.daily_scene_limit}</strong> AI scenes per day
                        </span>
                      </div>
                      {plan.monthly_chat_limit ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">
                            <strong>{plan.monthly_chat_limit}</strong> chats per month
                          </span>
                        </div>
                      ) : null}
                      {plan.monthly_scene_limit ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">
                            <strong>{plan.monthly_scene_limit}</strong> scenes per month
                          </span>
                        </div>
                      ) : null}
                      {plan.monthly_group_limit ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">
                            Join up to <strong>{plan.monthly_group_limit}</strong> groups
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-start gap-2">
                        {plan.dark_mode_access ? (
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                        )}
                        <span className={plan.dark_mode_access ? 'text-foreground' : 'text-muted-foreground line-through'}>
                          Dark Mode (24h auto-expire chats)
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">Priority support</span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      disabled={isCurrentPlan || pendingSub}
                      variant={isPopular && !isCurrentPlan ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {isCurrentPlan ? 'Current Plan' : pendingSub ? 'Pending...' : isActive ? 'Upgrade' : 'Subscribe'}
                    </Button>
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
                      {paymentInfo.length > 0 ? paymentInfo.map(p => (
                        <SelectItem key={p.id} value={p.method_name}>{p.method_name}</SelectItem>
                      )) : (
                        <>
                          <SelectItem value="JazzCash">JazzCash</SelectItem>
                          <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                          <SelectItem value="Nayapay">Nayapay</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Copyable payment details for selected method */}
                {method && (() => {
                  const info = paymentInfo.find(p => p.method_name === method);
                  if (!info) return null;
                  const copyText = async (text: string, label: string) => {
                    try {
                      await navigator.clipboard.writeText(text);
                      toast.success(`${label} copied`);
                    } catch {
                      toast.error('Copy failed');
                    }
                  };
                  return (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Send payment to</p>
                        <Badge variant="outline" className="text-xs">{info.method_name}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                          <button
                            type="button"
                            onClick={() => copyText(info.account_number, 'Account number')}
                            className="w-full flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-3 py-2 hover:border-primary/50 transition-colors group"
                          >
                            <span className="font-mono font-semibold text-foreground truncate">{info.account_number}</span>
                            <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          </button>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Account Holder</p>
                          <button
                            type="button"
                            onClick={() => copyText(info.account_holder, 'Name')}
                            className="w-full flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-3 py-2 hover:border-primary/50 transition-colors group"
                          >
                            <span className="font-medium text-foreground truncate">{info.account_holder}</span>
                            <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          </button>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Amount</p>
                          <button
                            type="button"
                            onClick={() => copyText(String(billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly), 'Amount')}
                            className="w-full flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-3 py-2 hover:border-primary/50 transition-colors group"
                          >
                            <span className="font-semibold text-foreground">
                              ${billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly}
                            </span>
                            <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        After sending, upload the screenshot below as proof.
                      </p>
                    </div>
                  );
                })()}
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
