import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, LogOut, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const GroupRequestDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [req, setReq] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: reqData }, { data: partsData }] = await Promise.all([
      (supabase as any).from('group_requests').select('*').eq('id', id).maybeSingle(),
      (supabase as any).from('group_participants').select('*').eq('request_id', id),
    ]);
    setReq(reqData);
    setParts(partsData || []);
    setLoading(false);

    // If chat created, jump
    if (reqData?.chat_id && reqData?.status === 'filled') {
      const isParticipant = (partsData || []).some((p: any) => p.user_id === user?.id && p.join_status === 'approved');
      if (isParticipant) navigate(`/chat/${reqData.chat_id}`);
    }
  }, [id, user?.id, navigate]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`group-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_participants', filter: `request_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_requests', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (loading) return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;
  if (!req) return <AppLayout><div className="p-6 text-center">Request not found.</div></AppLayout>;

  const isCreator = req.creator_id === user?.id;
  const myPart = parts.find((p: any) => p.user_id === user?.id);
  const approved = parts.filter((p: any) => p.join_status === 'approved');
  const pending = parts.filter((p: any) => p.join_status === 'pending');
  const seatsLeft = req.member_limit - approved.length;

  const join = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('join_group_request', { p_request_id: id });
      if (error) throw error;
      if (data) {
        toast.success('Group is full! Entering chat…');
        navigate(`/chat/${data}`);
      } else {
        toast.success('Joined! Waiting for the group to fill.');
        load();
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to join');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('leave_group_request', { p_request_id: id });
      if (error) throw error;
      toast.success('Left the group request');
      navigate('/groups');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (pid: string, approve: boolean) => {
    try {
      const { error } = await (supabase as any).rpc('respond_group_join', { p_participant_id: pid, p_approve: approve });
      if (error) throw error;
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    }
  };

  const gr = req.gender_requirements || {};
  const compLabel = [
    gr.men ? `${gr.men} men` : null,
    gr.women ? `${gr.women} women` : null,
    gr.any ? `${gr.any} any` : null,
  ].filter(Boolean).join(' + ');

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{req.topic}</Badge>
          <Badge>{req.status}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {req.ai_scene_title || 'Generating scene…'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {req.ai_scene_description ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{req.ai_scene_description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">AI is crafting your scene…</p>
            )}
            {req.ai_icebreakers && req.ai_icebreakers.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Icebreakers</p>
                <ul className="space-y-1 text-sm">
                  {req.ai_icebreakers.map((q: string, i: number) => <li key={i}>• {q}</li>)}
                </ul>
              </div>
            )}
            {req.mood_tags && req.mood_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {req.mood_tags.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Composition</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{compLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">{approved.length}/{req.member_limit} approved · {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</p>
          </CardContent>
        </Card>

        {isCreator && pending.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Pending join requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pending.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-sm">User {p.user_id.slice(0, 6)} · slot: {p.gender_slot}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => respond(p.id, true)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => respond(p.id, false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          {myPart ? (
            <Button variant="outline" onClick={leave} disabled={busy} className="flex-1">
              <LogOut className="h-4 w-4 mr-1" /> Leave
            </Button>
          ) : (
            req.status === 'open' && (
              <Button onClick={join} disabled={busy} className="flex-1" size="lg">
                Join group
              </Button>
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default GroupRequestDetailPage;
