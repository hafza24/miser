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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, CreditCard, Wallet, RefreshCw, ExternalLink, Search, Inbox, Check, CheckCheck,
} from 'lucide-react';

type Source = 'subscriptions' | 'payment_requests';
type Status = 'pending' | 'active' | 'expired' | 'cancelled' | 'approved' | 'rejected' | 'all';

const PAGE_SIZE = 10;

// Per-admin persistent read state for inbox rows
const readStorageKey = (adminId: string, source: Source) =>
  `admin_inbox_read_${source}_${adminId}`;

const loadReadSet = (adminId: string, source: Source): Set<string> => {
  try {
    const raw = localStorage.getItem(readStorageKey(adminId, source));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const persistReadSet = (adminId: string, source: Source, ids: Set<string>) => {
  try {
    localStorage.setItem(readStorageKey(adminId, source), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
};

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { markRead, refreshNotifications } = useNotifications();
  const [source, setSource] = useState<Source>('subscriptions');
  const [status, setStatus] = useState<Status>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [pendingUnread, setPendingUnread] = useState<{ subscriptions: number; payment_requests: number }>({
    subscriptions: 0,
    payment_requests: 0,
  });

  // Hydrate read-set when admin or source changes
  useEffect(() => {
    if (!user) return;
    setReadIds(loadReadSet(user.id, source));
  }, [user?.id, source]);

  // Fetch pending unread counts across both sources for tab badges
  const refreshPendingCounts = useCallback(async () => {
    if (!user) return;
    const [subs, pays] = await Promise.all([
      supabase.from('subscriptions').select('id').eq('status', 'pending'),
      supabase.from('payment_requests').select('id').eq('status', 'pending'),
    ]);
    const subRead = loadReadSet(user.id, 'subscriptions');
    const payRead = loadReadSet(user.id, 'payment_requests');
    setPendingUnread({
      subscriptions: (subs.data || []).filter((r: any) => !subRead.has(r.id)).length,
      payment_requests: (pays.data || []).filter((r: any) => !payRead.has(r.id)).length,
    });
  }, [user?.id]);

  useEffect(() => { refreshPendingCounts(); }, [refreshPendingCounts, readIds]);

  // Realtime: react to any change on subscriptions / payment_requests
  useEffect(() => {
    if (!user) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        load();
        refreshPendingCounts();
        refreshNotifications();
      }, 300);
    };
    const channel = supabase
      .channel(`admin-inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, bump)
      // Read-state sync across this admin's devices via broadcast
      .on('broadcast', { event: 'read-state' }, (msg) => {
        const p = msg.payload as { source: Source; ids: string[]; adminId: string };
        if (!p || p.adminId !== user.id) return;
        const next = new Set(p.ids);
        persistReadSet(user.id, p.source, next);
        if (p.source === source) setReadIds(next);
        refreshPendingCounts();
      })
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, source]);

  // Cross-tab sync via storage event (same device, other tabs)
  useEffect(() => {
    if (!user) return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === readStorageKey(user.id, source)) {
        setReadIds(loadReadSet(user.id, source));
      }
      if (
        e.key === readStorageKey(user.id, 'subscriptions') ||
        e.key === readStorageKey(user.id, 'payment_requests')
      ) {
        refreshPendingCounts();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user?.id, source, refreshPendingCounts]);


  const persistRead = (next: Set<string>) => {
    if (!user) return;
    setReadIds(new Set(next));
    persistReadSet(user.id, source, next);
    refreshNotifications();
  };

  const markRowRead = (rowId: string) => {
    const next = new Set(readIds);
    next.add(rowId);
    persistRead(next);
    const prefix = source === 'subscriptions' ? 'admin-sub-pending-' : 'admin-payreq-pending-';
    markRead(`${prefix}${rowId}`);
  };

  const markRowUnread = (rowId: string) => {
    const next = new Set(readIds);
    next.delete(rowId);
    persistRead(next);
  };

  const markAllVisibleRead = () => {
    const next = new Set(readIds);
    rows.forEach((r) => next.add(r.id));
    persistRead(next);
  };


  const statusOptions = useMemo<Status[]>(
    () =>
      source === 'subscriptions'
        ? ['pending', 'active', 'expired', 'cancelled', 'all']
        : ['pending', 'approved', 'rejected', 'all'],
    [source],
  );

  useEffect(() => { setPage(1); setStatus('pending'); }, [source]);

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from(source)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status !== 'all') query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) {
      setRows([]); setTotal(0); setLoading(false);
      return;
    }

    let list = data || [];
    if (list.length) {
      const userIds = [...new Set(list.map((r: any) => r.user_id))];
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, alias, email, emoji_avatar')
        .in('user_id', userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfilesById(map);

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter((r: any) => {
          const p = map[r.user_id];
          return (
            p?.alias?.toLowerCase().includes(q) ||
            p?.email?.toLowerCase().includes(q) ||
            r.transaction_id?.toLowerCase?.().includes(q) ||
            r.name?.toLowerCase?.().includes(q)
          );
        });
      }
    }
    setRows(list);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [source, status, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-warning/15 text-warning border-warning/30',
      active: 'bg-green-600/15 text-green-600 border-green-600/30',
      approved: 'bg-green-600/15 text-green-600 border-green-600/30',
      expired: 'bg-destructive/15 text-destructive border-destructive/30',
      rejected: 'bg-destructive/15 text-destructive border-destructive/30',
      cancelled: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <Badge variant="outline" className={`capitalize ${map[s] || ''}`}>{s}</Badge>
    );
  };

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
                disabled={rows.length === 0 || rows.every((r) => readIds.has(r.id))}
                className="gap-1"
              >
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
              <Button variant="outline" size="sm" onClick={() => { load(); refreshPendingCounts(); }} className="gap-1">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          }
        />

        <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
          <TabsList>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="h-4 w-4" /> Subscriptions
              {pendingUnread.subscriptions > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-destructive text-destructive-foreground">
                  {pendingUnread.subscriptions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payment_requests" className="gap-2">
              <Wallet className="h-4 w-4" /> Payment Requests
              {pendingUnread.payment_requests > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-destructive text-destructive-foreground">
                  {pendingUnread.payment_requests}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>


        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search by alias, email, transaction…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as Status); setPage(1); }}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={load} variant="secondary">Apply</Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing to review"
            description="No records match the current filters."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const p = profilesById[r.user_id];
              const isRead = readIds.has(r.id);
              return (
                <Card
                  key={r.id}
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
                        {source === 'payment_requests' ? (
                          <p className="text-sm text-foreground">
                            <span className="text-muted-foreground">Method:</span> {r.method}
                            {r.transaction_id && <> · <span className="text-muted-foreground">Txn:</span> {r.transaction_id}</>}
                          </p>
                        ) : (
                          <p className="text-sm text-foreground">
                            <span className="text-muted-foreground">Billing:</span> {r.billing_period} ·{' '}
                            <span className="text-muted-foreground">Expiry:</span>{' '}
                            {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {isRead ? (
                        <Button size="sm" variant="ghost" onClick={() => markRowUnread(r.id)} className="gap-1">
                          Mark unread
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => markRowRead(r.id)} className="gap-1">
                          <Check className="h-3.5 w-3.5" /> Mark read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          markRowRead(r.id);
                          navigate(source === 'subscriptions' ? '/admin/subscriptions' : '/admin/payments');
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

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
                const n = i + 1;
                return (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === page}
                      onClick={() => setPage(n)}
                      className="cursor-pointer"
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
