import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchIsAdmin } from './adminRoleCache';

export const useAdminRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchIsAdmin(user.id).then((v) => {
      if (cancelled) return;
      setIsAdmin(v);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isAdmin, loading };
};
