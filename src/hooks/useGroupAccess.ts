import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useGroupAccess = () => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      const [{ data: access }, { data: setting }] = await Promise.all([
        (supabase as any).rpc('user_has_group_access', { _user_id: user.id }),
        supabase.from('app_settings').select('value').eq('key', 'group_requests_enabled').maybeSingle(),
      ]);
      setHasAccess(!!access);
      const val = (setting as any)?.value;
      setFeatureEnabled(val === undefined || val === true || val === 'true');
      setLoading(false);
    };
    load();
  }, [user]);

  return { hasAccess, featureEnabled, loading };
};
