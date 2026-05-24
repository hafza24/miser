import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Sparkles, Crown } from 'lucide-react';
import { useGroupAccess } from '@/hooks/useGroupAccess';
import { useAuth } from '@/contexts/AuthContext';

const BrowseGroupsPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasAccess, featureEnabled, loading: accessLoading } = useGroupAccess();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!hasAccess || !profile?.receive_group_invites) {
        setLoading(false);
        return;
      }
      const { data } = await (supabase as any).rpc('list_eligible_group_requests');
      setRequests(data || []);
      setLoading(false);
    };
    if (!accessLoading) load();
  }, [hasAccess, profile?.receive_group_invites, accessLoading]);

  if (accessLoading) {
    return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;
  }

  if (!featureEnabled) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Group requests are currently disabled.</div></AppLayout>;
  }

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="p-6 text-center space-y-4">
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
        <div className="p-6 text-center space-y-4">
          <h2 className="font-heading text-xl font-bold">Enable Group Invitations</h2>
          <p className="text-muted-foreground">Turn on the toggle in Settings to browse and join groups.</p>
          <Button onClick={() => navigate('/settings')}>Open Settings</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Group Requests
          </h2>
          <Button size="sm" onClick={() => navigate('/groups/new')}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">
            No open groups match you right now. Create one!
          </CardContent></Card>
        ) : (
          requests.map((r) => {
            const gr = r.gender_requirements || {};
            const compLabel = [
              gr.men ? `${gr.men}M` : null,
              gr.women ? `${gr.women}W` : null,
              gr.any ? `${gr.any} any` : null,
            ].filter(Boolean).join(' + ');
            return (
              <Card key={r.id} className="overflow-hidden hover:shadow-card transition-shadow cursor-pointer" onClick={() => navigate(`/groups/${r.id}`)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{r.topic}</Badge>
                    <Badge>{r.member_limit} people</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{compLabel}</p>
                  {r.ai_scene_title && (
                    <div className="pt-2">
                      <p className="font-heading font-semibold text-foreground flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-primary" />{r.ai_scene_title}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.ai_scene_description}</p>
                    </div>
                  )}
                  <Button size="sm" className="w-full mt-2">View & Join</Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppLayout>
  );
};

export default BrowseGroupsPage;
