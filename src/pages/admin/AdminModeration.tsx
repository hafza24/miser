import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ModerationLog {
  id: string;
  user_id: string;
  violation_type: string;
  message_text: string | null;
  created_at: string;
  profile?: { alias: string; emoji_avatar: string; email: string | null };
}

const AdminModeration = () => {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('moderation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        toast.error('Failed to load moderation logs');
        setLoading(false);
        return;
      }

      // Load profiles for user_ids
      const userIds = [...new Set((data ?? []).map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, alias, emoji_avatar, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      setLogs((data ?? []).map(log => ({
        ...log,
        profile: profileMap.get(log.user_id) ?? undefined,
      })));
      setLoading(false);
    };
    load();
  }, []);

  const violationColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'mute': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'suspension': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return '';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Moderation Logs</h2>
          <Badge variant="outline">{logs.length} logs</Badge>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground">No moderation logs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className="text-xl">{log.profile?.emoji_avatar || '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{log.profile?.alias || 'Unknown'}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 capitalize ${violationColor(log.violation_type)}`}>
                        {log.violation_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.message_text && (
                      <p className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1 break-all">
                        {log.message_text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{log.profile?.email || ''}</p>
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

export default AdminModeration;
