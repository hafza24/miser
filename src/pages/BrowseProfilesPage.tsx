import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, Check, Clock, X, Sparkles, Globe, Timer, Users, Ban, SlidersHorizontal, RotateCcw } from 'lucide-react';
import OnlineIndicator from '@/components/OnlineIndicator';
import { toast } from 'sonner';
import { COUNTRIES, AVAILABILITY_OPTIONS } from '@/lib/countries';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const PERSONALITY_OPTIONS = [
  'Kind', 'Rude', 'Romantic', 'Emotional', 'Friendly',
  'Mysterious', 'Funny', 'Shy', 'Bold', 'Caring',
  'Sarcastic', 'Adventurous', 'Calm', 'Energetic', 'Wise',
];

interface BrowseProfile {
  user_id: string;
  alias: string;
  emoji_avatar: string;
  bio: string | null;
  interests: string[] | null;
  mood_preference: string | null;
  region: string | null;
  availability: string | null;
  character_title: string | null;
  character_description: string | null;
  character_personality: string[] | null;
  character_life_story: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  gender: string | null;
}

type RequestStatus = 'none' | 'pending' | 'accepted' | 'declined';

interface RequestInfo {
  id: string;
  status: RequestStatus;
}

const BrowseProfilesPage = () => {
  const { user } = useAuth();
  const { mode } = useMode();
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestMap, setRequestMap] = useState<Record<string, RequestInfo>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterCountry || filterAvailability || filterGender || selectedTraits.length > 0;

  const resetFilters = () => {
    setFilterCountry('');
    setFilterAvailability('');
    setFilterGender('');
    setSelectedTraits([]);
  };

  useEffect(() => {
    if (!user) return;
    loadProfiles();
    loadMyRequests();
    loadBlockedUsers();
  }, [user]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id);
    setBlockedIds(new Set((data ?? []).map((d: any) => d.blocked_id)));
  };

  const loadProfiles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar, bio, interests, mood_preference, region, availability, character_title, character_description, character_personality, character_life_story, is_online, last_seen_at, gender')
      .neq('user_id', user.id)
      .eq('is_suspended', false)
      .order('is_online', { ascending: false })
      .limit(50);
    setProfiles(data || []);
    setLoading(false);
  };

  const loadMyRequests = async () => {
    if (!user) return;
    const { data } = await supabase.from('chat_requests').select('id, receiver_id, status').eq('sender_id', user.id);
    if (data) {
      const map: Record<string, RequestInfo> = {};
      data.forEach(r => { map[r.receiver_id] = { id: r.id, status: r.status as RequestStatus }; });
      setRequestMap(map);
    }
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    setActionId(receiverId);
    const { data, error } = await supabase.from('chat_requests').insert({ sender_id: user.id, receiver_id: receiverId }).select('id').single();
    setActionId(null);
    if (error) { if (error.code === '23505') toast.info('Request already sent'); else toast.error('Failed to send request'); }
    else if (data) { setRequestMap(prev => ({ ...prev, [receiverId]: { id: data.id, status: 'pending' } })); toast.success('Chat request sent!'); }
  };

  const cancelRequest = async (receiverId: string) => {
    const info = requestMap[receiverId];
    if (!info) return;
    setActionId(receiverId);
    const { error } = await supabase.from('chat_requests').delete().eq('id', info.id);
    setActionId(null);
    if (error) { toast.error('Failed to cancel'); }
    else { setRequestMap(prev => { const next = { ...prev }; delete next[receiverId]; return next; }); toast.success('Request cancelled'); }
  };

  const blockUser = async (blockedId: string) => {
    if (!user) return;
    setActionId(blockedId);
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: blockedId } as any);
    setActionId(null);
    if (error) { if (error.code === '23505') toast.info('Already blocked'); else toast.error('Failed to block user'); }
    else { setBlockedIds(prev => new Set([...prev, blockedId])); toast.success('User blocked.'); }
  };

  const toggleTrait = (trait: string) => {
    setSelectedTraits(prev => prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]);
  };

  const filtered = profiles.filter(p => {
    if (blockedIds.has(p.user_id)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesText = p.alias.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q) || p.interests?.some(i => i.toLowerCase().includes(q)) || p.region?.toLowerCase().includes(q) || p.character_title?.toLowerCase().includes(q) || p.character_description?.toLowerCase().includes(q);
      if (!matchesText) return false;
    }
    if (selectedTraits.length > 0) { const traits = p.character_personality || []; if (!selectedTraits.some(t => traits.includes(t))) return false; }
    if (filterCountry && p.region !== filterCountry) return false;
    if (filterAvailability && p.availability !== filterAvailability) return false;
    if (filterGender && p.gender !== filterGender) return false;
    return true;
  });

  const renderRequestButton = (profile: BrowseProfile) => {
    const info = requestMap[profile.user_id];
    const status: RequestStatus = info?.status as RequestStatus || 'none';
    const isActing = actionId === profile.user_id;

    if (status === 'accepted') {
      return <Button size="sm" variant="secondary" disabled className="flex-shrink-0 gap-1 text-xs h-8 px-2"><Check className="h-3 w-3" />Connected</Button>;
    }
    if (status === 'pending') {
      return <Button size="sm" variant="outline" disabled={isActing} onClick={() => cancelRequest(profile.user_id)} className="flex-shrink-0 gap-1 text-xs text-muted-foreground h-8 px-2"><Clock className="h-3 w-3" />Pending</Button>;
    }
    if (status === 'declined') {
      return <Button size="sm" variant="outline" disabled={isActing} onClick={() => cancelRequest(profile.user_id)} className="flex-shrink-0 gap-1 text-xs text-destructive h-8 px-2"><X className="h-3 w-3" />Declined</Button>;
    }
    return (
      <Button size="sm" variant="default" disabled={isActing} onClick={() => sendRequest(profile.user_id)} className="flex-shrink-0 gap-1 text-xs h-8 px-2.5">
        {isActing ? <Clock className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        {isActing ? '...' : 'Chat'}
      </Button>
    );
  };

  return (
    <AppLayout>
      <div className="p-4">
        <div className="mb-4">
          <h2 className="font-heading text-xl font-bold text-foreground mb-0.5">
            {mode === 'light' ? '🌸 Discover People' : '🔮 Discover People'}
          </h2>
          <p className="text-xs text-muted-foreground">Browse anonymous profiles and send chat requests</p>
        </div>

        {/* Search bar with filter icon */}
        <div className="relative mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by alias, interests..."
              className="pl-10 h-9 text-sm"
              maxLength={100}
            />
          </div>
          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 w-9 flex-shrink-0 relative"
            title="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
            )}
          </Button>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="mb-4 p-3 bg-muted/30 rounded-xl border border-border space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <RotateCcw className="h-3 w-3" />
                  Reset all
                </button>
              )}
            </div>

            {/* Dropdowns in a responsive grid */}
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <Select value={filterAvailability || 'all'} onValueChange={(v) => setFilterAvailability(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any time</SelectItem>
                    {AVAILABILITY_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <Select value={filterGender || 'all'} onValueChange={(v) => setFilterGender(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="All genders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genders</SelectItem>
                    {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Personality chips */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personality</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {PERSONALITY_OPTIONS.map((trait) => (
                  <Badge
                    key={trait}
                    variant={selectedTraits.includes(trait) ? 'default' : 'outline'}
                    className="cursor-pointer select-none transition-colors text-[10px] px-2 py-0.5"
                    onClick={() => toggleTrait(trait)}
                  >
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading profiles...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-muted-foreground">No profiles found</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((p) => (
              <div key={p.user_id} className="flex items-start gap-2.5 p-3 rounded-xl bg-card shadow-card border border-border">
                <div className="text-2xl flex-shrink-0 relative">
                  {p.emoji_avatar}
                  <OnlineIndicator isOnline={p.is_online} size="sm" className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-foreground truncate text-sm">{p.alias}</h3>
                    <OnlineIndicator isOnline={p.is_online} size="sm" showLabel lastSeenAt={p.last_seen_at} />
                  </div>
                  {p.character_title && (
                    <p className="text-[11px] font-medium text-primary mt-0.5 truncate">✨ {p.character_title}</p>
                  )}
                  {p.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.character_personality?.slice(0, 3).map((trait) => (
                      <span key={trait} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{trait}</span>
                    ))}
                    {p.region && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">🌍 {p.region}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {renderRequestButton(p)}
                  <Button size="sm" variant="ghost" onClick={() => blockUser(p.user_id)} disabled={actionId === p.user_id} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0" title="Block user">
                    <Ban className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BrowseProfilesPage;
