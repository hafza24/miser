import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Sparkles, Crown, Settings } from 'lucide-react';
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
    return <AppLayout><div className="flex justify-center py-16 text-muted-foreground animate-pulse">Loading access rights…</div></AppLayout>;
  }

  if (!featureEnabled) {
    return (
      <AppLayout>
        <EmptyState
          icon={Users}
          title="Groups Disabled"
          description="Group requests are currently disabled by the administrator."
        />
      </AppLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppLayout>
        <EmptyState
          icon={Crown}
          title="Limit Reached"
          description="Upgrade your plan to create or join more groups today."
          action={{
            label: "View Plans",
            onClick: () => navigate('/app/premium')
          }}
        />
      </AppLayout>
    );
  }

  if (!profile?.receive_group_invites) {
    return (
      <AppLayout>
        <EmptyState
          icon={Settings}
          title="Invitations Off"
          description="Enable 'Receive Group Invitations' in Settings to browse and join groups."
          action={{
            label: "Open Settings",
            onClick: () => navigate('/app/settings')
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader 
          title="Group Requests" 
          description="Find community groups that match your interests."
          actions={
            <Button size="sm" className="rounded-2xl" onClick={() => navigate('/app/groups/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> New Group
            </Button>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground animate-pulse">Scanning for groups…</div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No Groups Found"
            description="No open groups match your profile right now. Why not create one?"
            action={{
              label: "Create New Group",
              onClick: () => navigate('/app/groups/new')
            }}
          />
        ) : (
          <div className="grid gap-4">
            {requests.map((r) => {
              const gr = r.gender_requirements || {};
              const compLabel = [
                gr.men ? `${gr.men}M` : null,
                gr.women ? `${gr.women}W` : null,
                gr.any ? `${gr.any} any` : null,
              ].filter(Boolean).join(' + ');
              return (
              <div 
                key={r.id} 
                className="bg-card border border-border rounded-3xl p-6 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md group"
                onClick={() => navigate(`/app/groups/${r.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full px-3">{r.topic}</Badge>
                    <Badge variant="outline" className="rounded-full px-3">{r.member_limit} members max</Badge>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                    {compLabel}
                  </div>
                </div>

                {r.ai_scene_title && (
                  <div className="space-y-2 mb-4">
                    <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {r.ai_scene_title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                      {r.ai_scene_description}
                    </p>
                  </div>
                )}
                
                <Button variant="outline" className="w-full rounded-2xl border-primary/20 hover:bg-primary/5 font-bold">
                  View Details & Join
                </Button>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BrowseGroupsPage;
