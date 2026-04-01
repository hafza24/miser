import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  daily_chat_limit: number;
  daily_scene_limit: number;
  dark_mode_access: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  expiry_date: string;
  status: string;
  auto_renew: boolean;
  billing_period: string;
  plan?: SubscriptionPlan;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setPlans([]);
      setLoading(false);
      return;
    }

    const [subsRes, plansRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    const allPlans = (plansRes.data || []) as unknown as SubscriptionPlan[];
    setPlans(allPlans);

    if (subsRes.data && subsRes.data.length > 0) {
      const sub = subsRes.data[0] as unknown as UserSubscription;
      sub.plan = allPlans.find(p => p.id === sub.plan_id);
      setSubscription(sub);
    } else {
      setSubscription(null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Listen for realtime subscription changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  const isActive = subscription?.status === 'active' && 
    subscription?.expiry_date && new Date(subscription.expiry_date) > new Date();

  const hasDarkModeAccess = isActive && (subscription?.plan?.dark_mode_access ?? false);

  const daysLeft = subscription?.expiry_date
    ? Math.max(0, Math.ceil((new Date(subscription.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isExpiringSoon = isActive && daysLeft <= 3;

  return {
    subscription,
    plans,
    loading,
    isActive,
    hasDarkModeAccess,
    daysLeft,
    isExpiringSoon,
    refresh,
  };
};
