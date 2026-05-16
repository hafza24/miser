import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ModerationLog {
  id: string;
  user_id: string;
  violation_type: string;
  message_text: string | null;
  created_at: string;
  profile?: { alias: string; emoji_avatar: string; email: string | null };
}

interface MessageReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  chat_id: string | null;
  message_id: string | null;
  message_content: string | null;
  reason: string;
  status: string;
  created_at: string;
  reporter?: { alias: string; emoji_avatar: string };
  reported?: { alias: string; emoji_avatar: string };
}

const violationColor = (type: string) => {
  switch (type) {
    case 'warning': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'mute': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'suspension': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return '';
  }
};

const AdminModeration = () => {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: logsData }, { data: reportsData }] = await Promise.all([
      supabase.from('moderation_logs').select('*').order('created_at', { ascending: false }).limit(200),
      (supabase as any).from('message_reports').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    const userIds = new Set<string>();
    (logsData ?? []).forEach((l: any) => userIds.add(l.user_id));
    (reportsData ?? []).forEach((r: any) => { userIds.add(r.reporter_id); userIds.add(r.reported_user_id); });
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar, email')
      .in('user_id', [...userIds]);
    const pmap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    setLogs((logsData ?? []).map((log: any) => ({ ...log, profile: pmap.get(log.user_id) ?? undefined })));
    setReports((reportsData ?? []).map((r: any) => ({
      ...r,
      reporter: pmap.get(r.reporter_id) ?? undefined,
      reported: pmap.get(r.reported_user_id) ?? undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const updateReport = async (id: string, status: 'resolved' | 'dismissed') => {
    const { error } = await (supabase as any).from('message_reports').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update report'); return; }
    toast.success(`Report ${status}`);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const suspendUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ is_suspended: true }).eq('user_id', userId);
    if (error) { toast.error('Failed to suspend user'); return; }
    toast.success('User suspended');
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">Moderation</h2>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Reports ({reports.filter(r => r.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="logs">Violation Logs ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-2">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : reports.length === 0 ? (
              <p className="text-muted-foreground">No reports.</p>
            ) : reports.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={r.status === 'pending' ? 'default' : 'outline'} className="capitalize text-[10px]">{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reporter:</span>{' '}
                    <span className="font-medium">{r.reporter?.emoji_avatar} {r.reporter?.alias ?? 'Unknown'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reported:</span>{' '}
                    <span className="font-medium">{r.reported?.emoji_avatar} {r.reported?.alias ?? 'Unknown'}</span>
                  </div>
                  <div className="text-sm bg-muted/50 rounded px-2 py-1.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Reason:</p>
                    <p className="break-all">{r.reason}</p>
                  </div>
                  {r.message_content && (
                    <div className="text-sm bg-muted/30 rounded px-2 py-1.5 italic">
                      <p className="text-xs text-muted-foreground mb-0.5">Message:</p>
                      <p className="break-all">"{r.message_content}"</p>
                    </div>
                  )}
                  {r.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => updateReport(r.id, 'dismissed')}>Dismiss</Button>
                      <Button size="sm" onClick={() => updateReport(r.id, 'resolved')}>Resolve</Button>
                      <Button size="sm" variant="destructive" onClick={() => suspendUser(r.reported_user_id)}>Suspend user</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="logs" className="space-y-2">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground">No moderation logs yet.</p>
            ) : logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className="text-xl">{log.profile?.emoji_avatar || '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{log.profile?.alias || 'Unknown'}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 capitalize ${violationColor(log.violation_type)}`}>{log.violation_type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.message_text && (
                      <p className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1 break-all">{log.message_text}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{log.profile?.email || ''}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminModeration;
