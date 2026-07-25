import { supabase } from '@/integrations/supabase/client';

// In-memory + sessionStorage cache to eliminate redundant user_roles lookups.
// Previously the same query ran 4.5k+ times (AdminGuard + NotificationContext + re-renders).
type CacheEntry = { value: boolean; at: number };
const memCache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const storageKey = (uid: string) => `adminRole_v1_${uid}`;

const readSession = (uid: string): CacheEntry | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSession = (uid: string, entry: CacheEntry) => {
  try {
    sessionStorage.setItem(storageKey(uid), JSON.stringify(entry));
  } catch {
    /* ignore */
  }
};

const inflight = new Map<string, Promise<boolean>>();

export const fetchIsAdmin = async (userId: string): Promise<boolean> => {
  const mem = memCache.get(userId);
  if (mem && Date.now() - mem.at < TTL_MS) return mem.value;

  const sess = readSession(userId);
  if (sess) {
    memCache.set(userId, sess);
    return sess.value;
  }

  const existing = inflight.get(userId);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    const value = !!data;
    const entry: CacheEntry = { value, at: Date.now() };
    memCache.set(userId, entry);
    writeSession(userId, entry);
    return value;
  })();

  inflight.set(userId, p);
  try {
    return await p;
  } finally {
    inflight.delete(userId);
  }
};

export const clearAdminRoleCache = (userId?: string) => {
  if (userId) {
    memCache.delete(userId);
    try { sessionStorage.removeItem(storageKey(userId)); } catch { /* ignore */ }
  } else {
    memCache.clear();
  }
};
