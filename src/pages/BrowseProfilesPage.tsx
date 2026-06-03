import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, Check, Clock, X, Sparkles, Globe, Timer, Users, Ban, SlidersHorizontal, RotateCcw, Heart } from 'lucide-react';
import OnlineIndicator from '@/components/OnlineIndicator';
import { toast } from 'sonner';
import { COUNTRIES, AVAILABILITY_OPTIONS } from '@/lib/countries';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const PERSONALITY_OPTIONS = [
  'Kind', 'Rude', 'Romantic', 'Emotional', 'Friendly',
  'Mysterious', 'Funny', 'Shy', 'Bold', 'Caring',
  'Sarcastic', 'Adventurous', 'Calm', 'Energetic', 'Wise',
];

const LIGHT_INTERESTS = ['Emotional Support', 'Friendship', 'Cute Love'];
const DARK_INTERESTS = ['Flirting', 'Passionate Romance', 'Fantasy Roleplay'];

const INTEREST_EMOJIS: Record<string, string> = {
  'Emotional Support': '💛',
  'Friendship': '🤝',
  'Cute Love': '💕',
  'Flirting': '💋',
  'Passionate Romance': '🔥',
  'Fantasy Roleplay': '✨',
};

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
  mode_preference: string | null;
  presence_status?: 'online' | 'away' | 'busy' | 'invisible';
  looking_for?: string[];
  gender_preference?: string;
  country?: string | null;
  city?: string | null;
  age?: number | null;
  preferred_languages?: string[];
  primary_language?: string | null;
  matchScore?: number;
}

type RequestStatus = 'none' | 'pending' | 'accepted' | 'declined';

interface RequestInfo {
  id: string;
  status: RequestStatus;
}

const BrowseProfilesPage = () => {
  const { user, profile: myProfile } = useAuth();
  const { mode } = useMode();
  const [searchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestMap, setRequestMap] = useState<Record<string, RequestInfo>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() => {
    const param = searchParams.get('interest');
    return param ? [param] : [];
  });
  const [filterCountry, setFilterCountry] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [useSmartMatch, setUseSmartMatch] = useState(true);

  const modeInterests = mode === 'light' ? LIGHT_INTERESTS : DARK_INTERESTS;
  const hasActiveFilters = filterCountry || filterAvailability || filterGender || selectedTraits.length > 0 || selectedInterests.length > 0;

  const resetFilters = () => {
    setFilterCountry('');
    setFilterAvailability('');
    setFilterGender('');
    setSelectedTraits([]);
    setSelectedInterests([]);
  };

  useEffect(() => {
    if (!user) return;
    loadProfiles();
    loadMyRequests();
    loadBlockedUsers();
  }, [user, mode]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id);
    setBlockedIds(new Set((data ?? []).map((d: any) => d.blocked_id)));
  };

  const loadProfiles = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_public_profiles');
    const filtered = (data || [])
      .filter((p: any) => p.user_id !== user.id && p.mode_preference === mode)
      .slice(0, 200);
    setProfiles(filtered || []);
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

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  // Smart-match scoring: combines interests, looking_for, languages, and presence
  const scoreProfile = (p: BrowseProfile): number => {
    if (!myProfile) return 0;
    let s = 0;
    const myInterests = new Set(myProfile.interests ?? []);
    const overlap = (p.interests ?? []).filter((i) => myInterests.has(i)).length;
    s += overlap * 8;
    const myLooking = new Set(myProfile.looking_for ?? []);
    const lookOverlap = (p.looking_for ?? []).filter((l) => myLooking.has(l)).length;
    s += lookOverlap * 12;
    const myLangs = new Set([myProfile.primary_language, ...(myProfile.preferred_languages ?? [])].filter(Boolean) as string[]);
    const langOverlap = [p.primary_language, ...(p.preferred_languages ?? [])].filter((l) => l && myLangs.has(l)).length;
    s += langOverlap * 5;
    if (myProfile.country && p.country && myProfile.country === p.country) s += 6;
    if (myProfile.city && p.city && myProfile.city === p.city) s += 4;
    if (p.is_online) s += 3;
    if (p.presence_status === 'busy') s -= 2;
    return s;
  };

  // Smart preference filters (applied when smart match is on)
  const passesSmart = (p: BrowseProfile): boolean => {
    if (!useSmartMatch || !myProfile) return true;
    // Gender preference (viewer's preference applied to candidate.gender)
    if (myProfile.gender_preference !== 'any' && p.gender && p.gender !== myProfile.gender_preference) return false;
    // Location preference
    if (myProfile.location_preference === 'same_country' && myProfile.country && p.country && myProfile.country !== p.country) return false;
    if ((myProfile.location_preference === 'same_city' || myProfile.location_preference === 'near_me') && myProfile.city && p.city && myProfile.city !== p.city) return false;
    // Age range
    if (myProfile.age_min != null && p.age != null && p.age < myProfile.age_min) return false;
    if (myProfile.age_max != null && p.age != null && p.age > myProfile.age_max) return false;
    return true;
  };

  const filtered = profiles
    .filter((p) => {
      if (blockedIds.has(p.user_id)) return false;
      if (!passesSmart(p)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesText = p.alias.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q) || p.interests?.some((i) => i.toLowerCase().includes(q)) || p.region?.toLowerCase().includes(q) || p.character_title?.toLowerCase().includes(q) || p.character_description?.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (selectedInterests.length > 0) {
        const userInterests = p.interests || [];
        if (!selectedInterests.some((i) => userInterests.includes(i))) return false;
      }
      if (selectedTraits.length > 0) {
        const traits = p.character_personality || [];
        if (!selectedTraits.some((t) => traits.includes(t))) return false;
      }
      if (filterCountry && p.region !== filterCountry && p.country !== filterCountry) return false;
      if (filterAvailability && p.availability !== filterAvailability) return false;
      if (filterGender && p.gender !== filterGender) return false;
      return true;
    })
    .map((p) => ({ ...p, matchScore: scoreProfile(p) }))
    .sort((a, b) => {
      if (useSmartMatch) {
        const diff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        if (diff !== 0) return diff;
      }
      return (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0);
    })
    .slice(0, 100);


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
          <p className="text-xs text-muted-foreground">Find someone who understands you</p>
        </div>

        {/* Interest Selection Chips */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Heart className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interests</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {modeInterests.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                    transition-all duration-200 ease-out
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-soft scale-105'
                      : 'bg-secondary text-secondary-foreground hover:bg-primary/20 hover:scale-[1.02]'
                    }
                  `}
                >
                  {INTEREST_EMOJIS[interest]} {interest}
                </button>
              );
            })}
          </div>
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

        {/* Smart match toggle */}
        <div className="mb-3 flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs font-semibold text-foreground">Smart match</div>
              <div className="text-[11px] text-muted-foreground">Rank by your preferences (gender, location, age, interests, languages)</div>
            </div>
          </div>
          <button
            onClick={() => setUseSmartMatch((v) => !v)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${useSmartMatch ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {useSmartMatch ? 'On' : 'Off'}
          </button>
        </div>


        {/* Collapsible Filters */}
        {showFilters && (
          <div className="mb-4 p-3 bg-muted/30 rounded-xl border border-border space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More Filters</span>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <RotateCcw className="h-3 w-3" />
                  Reset all
                </button>
              )}
            </div>

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
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Finding people...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No matches found</h3>
            <p className="text-sm text-muted-foreground mb-4">Try selecting different interests or adjusting your filters.</p>
            {selectedInterests.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedInterests([])}>
                Clear interest filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'person' : 'people'} found</p>
            {filtered.map((p) => (
              <div key={p.user_id} className="flex items-start gap-2.5 p-3 rounded-xl bg-card shadow-card border border-border hover:shadow-soft transition-shadow">
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
                    {p.interests?.slice(0, 3).map((interest) => (
                      <span key={interest} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/30 text-accent-foreground font-medium">
                        {INTEREST_EMOJIS[interest] || '•'} {interest}
                      </span>
                    ))}
                    {p.character_personality?.slice(0, 2).map((trait) => (
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
