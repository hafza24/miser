import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Sparkles, Crown } from 'lucide-react';
import { GROUP_TOPICS, GROUP_SIZES, presetCompositions, GenderReq } from '@/lib/groupTopics';
import { useGroupAccess } from '@/hooks/useGroupAccess';
import { useMode } from '@/contexts/ModeContext';

const CreateGroupRequestPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { mode } = useMode();
  const { hasAccess, featureEnabled, loading: accessLoading } = useGroupAccess();
  const [size, setSize] = useState<number>(3);
  const [comp, setComp] = useState<GenderReq>({ men: 0, women: 0, any: 3 });
  const [topic, setTopic] = useState<string>('Friendship');
  const [type, setType] = useState<'threesome' | 'circle'>('threesome');
  const [submitting, setSubmitting] = useState(false);

  const compositions = presetCompositions(size);

  const handleSizeChange = (v: string) => {
    const n = parseInt(v, 10);
    setSize(n);
    setType(n <= 4 ? 'threesome' : 'circle');
    setComp({ men: 0, women: 0, any: n });
  };

  if (accessLoading) {
    return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;
  }

  if (!featureEnabled) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Group requests are currently disabled by the admin.</div>
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 text-center">
          <Crown className="h-12 w-12 mx-auto text-primary" />
          <h2 className="font-heading text-2xl font-bold">Premium feature</h2>
          <p className="text-muted-foreground">Group requests are available on premium plans.</p>
          <Button onClick={() => navigate('/subscription')}>View plans</Button>
        </div>
      </AppLayout>
    );
  }

  if (!profile?.receive_group_invites) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 text-center">
          <h2 className="font-heading text-xl font-bold">Enable Group Invitations first</h2>
          <p className="text-muted-foreground">Turn on "Receive Group Invitations" in Settings to create or join groups.</p>
          <Button onClick={() => navigate('/settings')}>Open Settings</Button>
        </div>
      </AppLayout>
    );
  }

  const submit = async () => {
    if (comp.men + comp.women + comp.any !== size) {
      toast.error('Gender composition must sum to group size');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('create_group_request', {
        p_type: type,
        p_member_limit: size,
        p_gender_requirements: comp,
        p_topic: topic,
        p_mode: mode,
      });
      if (error) throw error;
      const id = data as string;
      toast.success('Group request created! Generating scene…');
      // Fire-and-forget scene generation
      supabase.functions.invoke('generate-group-scene', { body: { request_id: id } }).catch(() => {});
      navigate(`/groups/${id}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Create Group Request
          </h2>
          <p className="text-sm text-muted-foreground">Curated private group chat with AI-generated scene.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Group size</CardTitle></CardHeader>
          <CardContent>
            <Select value={String(size)} onValueChange={handleSizeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_SIZES.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} people {n <= 4 ? '(threesome-style)' : '(friend circle)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Gender composition</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {compositions.map((opt, i) => {
              const selected = comp.men === opt.req.men && comp.women === opt.req.women && comp.any === opt.req.any;
              return (
                <button
                  key={i}
                  onClick={() => setComp(opt.req)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{opt.label}</span>
                    {selected && <Badge>Selected</Badge>}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Topic</CardTitle></CardHeader>
          <CardContent>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
          <Users className="h-4 w-4 mr-2" />
          {submitting ? 'Creating…' : 'Create group request'}
        </Button>
      </div>
    </AppLayout>
  );
};

export default CreateGroupRequestPage;
