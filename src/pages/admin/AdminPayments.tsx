import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, ExternalLink, Image } from 'lucide-react';

interface PaymentRequest {
  id: string;
  user_id: string;
  name: string;
  method: string;
  transaction_id: string | null;
  screenshot_url: string | null;
  signed_screenshot_url?: string | null;
  status: string;
  created_at: string;
  alias?: string;
  emoji_avatar?: string;
  email?: string;
}

const AdminPayments = () => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const loadRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load payment requests');
      setLoading(false);
      return;
    }

    // Enrich with profile info and signed URLs
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar, email')
        .in('user_id', userIds);

      // Generate signed URLs for screenshots
      const enriched = await Promise.all(data.map(async (r: any) => {
        const p = profiles?.find((p: any) => p.user_id === r.user_id);
        let signedUrl: string | null = null;
        if (r.screenshot_url) {
          // If it's a file path (not a full URL), create a signed URL
          const path = r.screenshot_url.startsWith('http')
            ? null
            : r.screenshot_url;
          if (path) {
            const { data: signedData } = await supabase.storage
              .from('payment-screenshots')
              .createSignedUrl(path, 3600); // 1 hour expiry
            signedUrl = signedData?.signedUrl || null;
          } else {
            signedUrl = r.screenshot_url; // legacy full URLs
          }
        }
        return { ...r, alias: p?.alias, emoji_avatar: p?.emoji_avatar, email: p?.email, signed_screenshot_url: signedUrl };
      }));
      setRequests(enriched);
    } else {
      setRequests([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const handleAction = async (request: PaymentRequest, action: 'approved' | 'rejected') => {
    setUpdating(request.id);
    try {
      // Update payment request
      const { error: reqError } = await supabase
        .from('payment_requests')
        .update({ status: action, reviewed_at: new Date().toISOString() })
        .eq('id', request.id);
      if (reqError) throw reqError;

      if (action === 'approved') {
        // Unlock dark mode and update payment status
        const { error: profError } = await supabase
          .from('profiles')
          .update({ dark_mode_blocked: false, payment_status: 'approved' } as any)
          .eq('user_id', request.user_id);
        if (profError) throw profError;
        toast.success(`Dark mode unlocked for ${request.alias || request.name}`);
      } else {
        const { error: profError } = await supabase
          .from('profiles')
          .update({ payment_status: 'rejected' } as any)
          .eq('user_id', request.user_id);
        if (profError) throw profError;
        toast.success(`Payment rejected for ${request.alias || request.name}`);
      }

      setRequests(prev =>
        prev.map(r => r.id === request.id ? { ...r, status: action } : r)
      );
    } catch (err: any) {
      toast.error('Action failed: ' + (err.message || 'Unknown error'));
    }
    setUpdating(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'approved': return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Payment Requests</h2>
          <Badge variant="outline">{requests.length} requests</Badge>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No {filter !== 'all' ? filter : ''} payment requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* User info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl">{req.emoji_avatar || '💫'}</span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-semibold text-foreground">{req.alias || 'Unknown'}</span>
                          {statusBadge(req.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{req.email || 'No email'}</p>
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">Name:</span> {req.name}
                        </p>
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">Method:</span> {req.method}
                        </p>
                        {req.transaction_id && (
                          <p className="text-sm text-foreground">
                            <span className="text-muted-foreground">TX ID:</span> {req.transaction_id}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Screenshot */}
                    {req.screenshot_url && (
                      <div className="flex-shrink-0">
                        <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="w-32 h-24 rounded-lg border border-border overflow-hidden bg-muted relative group">
                            <img
                              src={req.screenshot_url}
                              alt="Payment screenshot"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleAction(req, 'approved')}
                          disabled={updating === req.id}
                          className="gap-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleAction(req, 'rejected')}
                          disabled={updating === req.id}
                          className="gap-1"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;
