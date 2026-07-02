import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDistanceToNow } from 'date-fns';
import {
  CreditCard, Wallet, RefreshCw, ExternalLink, Search, Inbox, Check, CheckCheck, ThumbsUp, ThumbsDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type Source = 'subscriptions' | 'payment_requests';
type FilterStatus = 'pending' | 'all';
type FilterType = 'all' | Source;

interface InboxRow {
  id: string;
  source: Source;
  user_id: string;
  status: string;
  created_at: string;
  raw: any;
}

const readStorageKey = (adminId: string) => `admin_inbox_read_unified_${adminId}`;

const loadReadSet = (adminId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(readStorageKey(adminId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const persistReadSet = (adminId: string, ids: Set<string>) => {
  try {
    localStorage.setItem(readStorageKey(adminId), JSON.stringify([...ids]));
  } catch { /* ignore */ }
};

const keyOf = (r: InboxRow) => `${r.source}:${r.id}`;

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { markRead, refreshNotifications } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [actionId, setActionId] = useState<string | null>(null);

  const handlePaymentAction = async (r: InboxRow, action: 'approved' | 'rejected') => {
    setActionId(r.id);
    try {
      const { error: reqError } = await supabase
        .from('payment_requests')
        .update({ status: action, reviewed_at: new Date().toISOString() })
        .eq('id', r.id);
      if (reqError) throw reqError;

      const profileUpdate = action === 'approved'
        ? { dark_mode_blocked: false, payment_status: 'approved' }
        : { payment_status: 'rejected' };
      const { error: profError } = await supabase
        .from('profiles')
        .update(profileUpdate as any)
        .eq('user_id', r.user_id);
      if (profError) throw profError;

      toast.success(action === 'approved' ? 'Payment approved' : 'Payment rejected');
      setRows(prev => prev.map(x => x.id === r.id && x.source === 'payment_requests' ? { ...x, status: action } : x));
      markRowRead(r);
    } catch (err: any) {
      toast.error('Action failed: ' + (err.message || 'Unknown'));
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    setReadIds(loadReadSet(user.id));
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [subsRes, paysRes] = await Promise.all([
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('payment_requests').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const merged: InboxRow[] = [
      ...((subsRes.data || []).map((r: any) => ({
        id: r.id, source: 'subscriptions' as const, user_id: r.user_id,
        status: r.status, created_at: r.created_at, raw: r,
      }))),
      ...((paysRes.data || []).map((r: any) => ({
        id: r.id, source: 'payment_requests' as const, user_id: r.user_id,
        status: r.status, created_at: r.created_at, raw: r,
      }))),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const userIds = [...new Set(merged.map(r => r.user_id))];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, alias, email, emoji_avatar')
        .in('user_id', userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfilesById(map);
    }

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { load(); refreshNotifications(); }, 300);
    };
    const channel = supabase
      .channel(`admin-inbox-unified-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, bump)
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [user?.id, load, refreshNotifications]);

  const persistRead = (next: Set<string>) => {
    if (!user) return;
    setReadIds(new Set(next));
    persistReadSet(user.id, next);
    refreshNotifications();
  };

  const markRowRead = (r: InboxRow) => {
    const next = new Set(readIds);
    next.add(keyOf(r));
    persistRead(next);
    const prefix = r.source === 'subscriptions' ? 'admin-sub-pending-' : 'admin-payreq-pending-';
    markRead(`${prefix}${r.id}`);
  };

  const markRowUnread = (r: InboxRow) => {
    const next = new Set(readIds);
    next.delete(keyOf(r));
    persistRead(next);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (typeFilter !== 'all' && r.source !== typeFilter) return false;
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (q) {
        const p = profilesById[r.user_id];
        const hay = [
          p?.alias, p?.email, r.raw?.transaction_id, r.raw?.method, r.raw?.billing_period,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, search, profilesById]);

  const markAllVisibleRead = () => {
    const next = new Set(readIds);
    filtered.forEach(r => next.add(keyOf(r)));
    persistRead(next);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-warning/15 text-warning border-warning/30',
      active: 'bg-green-600/15 text-green-600 border-green-600/30',
      approved: 'bg-green-600/15 text-green-600 border-green-600/30',
      expired: 'bg-destructive/15 text-destructive border-destructive/30',
      rejected: 'bg-destructive/15 text-destructive border-destructive/30',
      cancelled: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={`capitalize ${map[s] || ''}`}>{s}</Badge>;
  };

  const typeBadge = (source: Source) => (
    source === 'subscriptions'
      ? <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><CreditCard className="h-3 w-3" /> Subscription</Badge>
      : <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><Wallet className="h-3 w-3" /> Payment</Badge>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Notifications Inbox"
          description="Pending subscriptions and payment requests awaiting review."
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={markAllVisibleRead}
                disabled={filtered.length === 0 || filtered.every(r => readIds.has(keyOf(r)))}
                className="gap-1"
              >
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
              <Button variant="outline" size="sm" onClick={load} className="gap-1">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          }
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by alias, email, transaction…"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FilterType)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="subscriptions">Subscriptions</SelectItem>
              <SelectItem value="payment_requests">Payment Requests</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing to review"
            description="No records match the current filters."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const p = profilesById[r.user_id];
              const isRead = readIds.has(keyOf(r));
              return (
                <Card
                  key={keyOf(r)}
                  className={`shadow-sm transition-colors ${!isRead ? 'border-primary/40 bg-primary/[0.03]' : ''}`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg">
                          {p?.emoji_avatar || '💫'}
                        </div>
                        {!isRead && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">
                            {p?.alias || 'Unknown user'}
                          </span>
                          {typeBadge(r.source)}
                          {statusBadge(r.status)}
                          {!isRead && (
                            <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                              Unread
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p?.email}</p>
                        {r.source === 'payment_requests' ? (
                          <p className="text-sm text-foreground">
                            <span className="text-muted-foreground">Method:</span> {r.raw.method}
                            {r.raw.transaction_id && <> · <span className="text-muted-foreground">Txn:</span> {r.raw.transaction_id}</>}
                          </p>
                        ) : (
                          <p className="text-sm text-foreground">
                            <span className="text-muted-foreground">Billing:</span> {r.raw.billing_period} ·{' '}
                            <span className="text-muted-foreground">Expiry:</span>{' '}
                            {r.raw.expiry_date ? new Date(r.raw.expiry_date).toLocaleDateString() : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {isRead ? (
                        <Button size="sm" variant="ghost" onClick={() => markRowUnread(r)} className="gap-1">
                          Mark unread
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => markRowRead(r)} className="gap-1">
                          <Check className="h-3.5 w-3.5" /> Mark read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          markRowRead(r);
                          navigate(r.source === 'subscriptions' ? '/admin/subscriptions' : '/admin/payments');
                        }}
                        className="gap-1"
                      >
                        Review <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
