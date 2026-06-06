import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const AdminGroups = () => {
  const [enabled, setEnabled] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [groupMax, setGroupMax] = useState(8);
  const [presenceEnabled, setPresenceEnabled] = useState(true);
  const [autoTrEnabled, setAutoTrEnabled] = useState(true);
  const [freeChat, setFreeChat] = useState(3);
  const [freeGroup, setFreeGroup] = useState(1);
  const [freeScene, setFreeScene] = useState(0);
  const [freePresence, setFreePresence] = useState(false);
  const [freeAutoTr, setFreeAutoTr] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: settings }, { data: reqs }] = await Promise.all([
      supabase.from('app_settings').select('*').in('key', [
        'group_requests_enabled','group_require_admin_approval','group_daily_create_limit','group_max_members',
        'presence_feature_enabled','auto_translate_feature_enabled',
        'free_daily_chat_limit','free_daily_group_limit','free_daily_scene_limit','free_presence_access','free_auto_translate_access',
      ]),
      (supabase as any).from('group_requests').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const toInt = (v: any, d: number) => typeof v === 'number' ? v : parseInt(String(v), 10) || d;
    const toBool = (v: any, d: boolean) => v === true || v === 'true' ? true : v === false || v === 'false' ? false : d;
    for (const s of settings || []) {
      if (s.key === 'group_requests_enabled') setEnabled(toBool(s.value, true));
      if (s.key === 'group_require_admin_approval') setRequireApproval(toBool(s.value, false));
      if (s.key === 'group_daily_create_limit') setDailyLimit(toInt(s.value, 3));
      if (s.key === 'group_max_members') setGroupMax(toInt(s.value, 8));
      if (s.key === 'presence_feature_enabled') setPresenceEnabled(toBool(s.value, true));
      if (s.key === 'auto_translate_feature_enabled') setAutoTrEnabled(toBool(s.value, true));
      if (s.key === 'free_daily_chat_limit') setFreeChat(toInt(s.value, 3));
      if (s.key === 'free_daily_group_limit') setFreeGroup(toInt(s.value, 1));
      if (s.key === 'free_daily_scene_limit') setFreeScene(toInt(s.value, 0));
      if (s.key === 'free_presence_access') setFreePresence(toBool(s.value, false));
      if (s.key === 'free_auto_translate_access') setFreeAutoTr(toBool(s.value, false));
    }
    setRequests(reqs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveSetting = async (key: string, value: any) => {
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() } as any);
    if (error) toast.error(error.message);
    else toast.success('Saved');
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from('group_requests').update({ status }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Updated'); load(); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold">Group Requests</h2>

        <Card>
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Feature enabled</Label>
              <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); saveSetting('group_requests_enabled', v); }} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require admin approval for joins</Label>
              <Switch checked={requireApproval} onCheckedChange={(v) => { setRequireApproval(v); saveSetting('group_require_admin_approval', v); }} />
            </div>
            <div className="flex items-center gap-3">
              <Label className="flex-1">Daily create limit per user</Label>
              <Input type="number" min={1} max={20} value={dailyLimit} onChange={e => setDailyLimit(parseInt(e.target.value, 10) || 1)} className="w-24" />
              <Button size="sm" onClick={() => saveSetting('group_daily_create_limit', dailyLimit)}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent requests ({requests.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : requests.length === 0 ? (
              <p className="text-muted-foreground text-sm">No requests yet.</p>
            ) : requests.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-border flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{r.topic}</Badge>
                    <Badge>{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{r.member_limit}p · {r.type}</span>
                  </div>
                  {r.ai_scene_title && <p className="text-sm mt-1 truncate">{r.ai_scene_title}</p>}
                </div>
                <div className="flex gap-1">
                  {r.status !== 'closed' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'closed')}>Close</Button>}
                  {r.status !== 'rejected' && <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, 'rejected')}>Reject</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminGroups;
