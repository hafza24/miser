import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  profile?: { alias: string; emoji_avatar: string; email: string | null };
}

const AdminTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'replied' | 'closed'>('all');

  const loadTickets = async () => {
    setLoading(true);
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load tickets');
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data ?? []).map((d: any) => d.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar, email')
      .in('user_id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    setTickets((data ?? []).map((t: any) => ({
      ...t,
      profile: profileMap.get(t.user_id) ?? undefined,
    })));
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [filter]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-tickets')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_tickets',
      }, () => {
        loadTickets();
        toast.info('New support ticket received!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    if (replyText.trim().length < 2 || replyText.trim().length > 2000) {
      toast.error('Reply must be 2-2000 characters');
      return;
    }

    setSending(true);
    const { error } = await supabase
      .from('support_tickets')
      .update({
        admin_reply: replyText.trim(),
        status: 'replied',
        replied_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (error) {
      toast.error('Failed to send reply');
    } else {
      toast.success('Reply sent!');
      setReplyText('');
      setReplyingTo(null);
      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, admin_reply: replyText.trim(), status: 'replied', replied_at: new Date().toISOString() } : t
      ));
    }
    setSending(false);
  };

  const closeTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId);

    if (error) {
      toast.error('Failed to close ticket');
    } else {
      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: 'closed' } : t
      ));
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'open': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'replied': return 'bg-primary/10 text-primary border-primary/20';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return '';
    }
  };

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold text-foreground">Support Tickets</h2>
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs">{openCount} open</Badge>
            )}
          </div>
          <Badge variant="outline">{tickets.length} tickets</Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'open', 'replied', 'closed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No tickets found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{ticket.profile?.emoji_avatar || '👤'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.profile?.alias || 'Unknown'} · {ticket.profile?.email || ''} · {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0 capitalize flex-shrink-0 ${statusColor(ticket.status)}`}>
                      {ticket.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{ticket.message}</p>

                  {ticket.admin_reply && (
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-primary mb-1">Your Reply:</p>
                      <p className="text-sm text-foreground">{ticket.admin_reply}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  {replyingTo === ticket.id ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Type your reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        maxLength={2000}
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleReply(ticket.id)} disabled={sending || !replyText.trim()}>
                          {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      {ticket.status !== 'closed' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => { setReplyingTo(ticket.id); setReplyText(ticket.admin_reply || ''); }}>
                            {ticket.admin_reply ? 'Edit Reply' : 'Reply'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => closeTicket(ticket.id)}>
                            Close
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTickets;
