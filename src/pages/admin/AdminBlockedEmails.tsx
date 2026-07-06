import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Trash2, ShieldBan, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  id: string;
  email: string;
  reason: string | null;
  created_at: string;
}

export default function AdminBlockedEmails() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_emails' as any)
      .select('id, email, reason, created_at')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('admin_block_email' as any, {
      p_email: clean,
      p_reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Email blocked');
    setEmail('');
    setReason('');
    load();
  };

  const remove = async (id: string, addr: string) => {
    if (!confirm(`Unblock ${addr}?`)) return;
    const { error } = await supabase.from('blocked_emails' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Unblocked');
      setRows((r) => r.filter((x) => x.id !== id));
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Blocked Emails"
          description="Emails on this list cannot register a new Fur&Fir account."
        />

        <Card className="p-4">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
            <Button type="submit" disabled={saving} className="gap-2">
              <ShieldBan className="h-4 w-4" />
              {saving ? 'Blocking…' : 'Block'}
            </Button>
          </form>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No blocked emails yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{r.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.reason || 'No reason'} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id, r.email)} aria-label="Unblock">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
