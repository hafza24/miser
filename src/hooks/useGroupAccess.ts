import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// hasAccess = user is allowed to create at least one group per day (free tier or plan).
export const useGroupAccess = () => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      const [{ data: limit }, { data: setting }] = await Promise.all([
        (supabase as any).rpc('effective_daily_group_limit', { _uid: user.id }),
        supabase.from('app_settings').select('value').eq('key', 'group_requests_enabled').maybeSingle(),
      ]);
      const n = typeof limit === 'number' ? limit : parseInt(String(limit ?? 0), 10) || 0;
      setDailyLimit(n);
      setHasAccess(n > 0);
      const val = (setting as any)?.value;
      setFeatureEnabled(val === undefined || val === true || val === 'true');
      setLoading(false);
    };
    load();
  }, [user]);

  return { hasAccess, featureEnabled, dailyLimit, loading };
};
