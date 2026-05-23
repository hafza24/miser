import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageCircle, Sparkles, Pencil, Check, X } from 'lucide-react';
import OnlineIndicator from '@/components/OnlineIndicator';
import { COUNTRIES, AVAILABILITY_OPTIONS } from '@/lib/countries';
import { LANGUAGES } from '@/lib/languages';
import { Switch } from '@/components/ui/switch';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const EMOJI_OPTIONS = ['🙂', '😈', '🐼', '🌙', '🐯', '🦊', '💫', '🦋', '🌸', '🔥', '🌊', '⭐', '🎭', '🦄', '🐺', '😎', '🤖', '👻', '🐱', '🐶', '🦁', '🐸', '🍀', '🌈', '💎', '🎵', '🏆', '🌺', '🍄', '🦉'];

const DAILY_CHAT_LIMIT = 3;

const PERSONALITY_OPTIONS = [
  'Kind', 'Rude', 'Romantic', 'Emotional', 'Friendly',
  'Mysterious', 'Funny', 'Shy', 'Bold', 'Caring',
  'Sarcastic', 'Adventurous', 'Calm', 'Energetic', 'Wise',
];

const INTEREST_OPTIONS = ['Friendship', 'Cute Love', 'Emotional Support'];

const ProfilePage = () => {
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState(profile?.bio || '');
  const [region, setRegion] = useState(profile?.region || '');
  const [availability, setAvailability] = useState(profile?.availability || '');
  const [saving, setSaving] = useState(false);
  const [chatsUsedToday, setChatsUsedToday] = useState(0);

  // Alias editing
  const [editingAlias, setEditingAlias] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);

  // Character fields
  const [charTitle, setCharTitle] = useState(profile?.character_title || '');
  const [charDescription, setCharDescription] = useState(profile?.character_description || '');
  const [charPersonality, setCharPersonality] = useState<string[]>(profile?.character_personality || []);
  const [charLifeStory, setCharLifeStory] = useState(profile?.character_life_story || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [emojiAvatar, setEmojiAvatar] = useState(profile?.emoji_avatar || '🙂');
  const [selectedInterest, setSelectedInterest] = useState<string>(
    (profile?.interests && profile.interests.length > 0) ? profile.interests[0] : ''
  );
  const [primaryLanguage, setPrimaryLanguage] = useState<string>((profile as any)?.primary_language || 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState<string>((profile as any)?.secondary_language || '');
  const [autoTranslate, setAutoTranslate] = useState<boolean>((profile as any)?.auto_translate_enabled ?? true);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setRegion(profile.region || '');
      setAvailability(profile.availability || '');
      setCharTitle(profile.character_title || '');
      setCharDescription(profile.character_description || '');
      setCharPersonality(profile.character_personality || []);
      setCharLifeStory(profile.character_life_story || '');
      setGender(profile.gender || '');
      setEmojiAvatar(profile.emoji_avatar || '🙂');
      setSelectedInterest((profile.interests && profile.interests.length > 0) ? profile.interests[0] : '');
      setPrimaryLanguage((profile as any).primary_language || 'en');
      setSecondaryLanguage((profile as any).secondary_language || '');
      setAutoTranslate((profile as any).auto_translate_enabled ?? true);
    }
  }, [profile]);

  useEffect(() => {
    const fetchDailyCount = async () => {
      if (!profile) return;
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('chat_participants')
        .select('id, chats!inner(created_at)', { count: 'exact', head: true })
        .eq('user_id', profile.user_id)
        .gte('chats.created_at', todayStart.toISOString());
      setChatsUsedToday(count ?? 0);
    };
    fetchDailyCount();
  }, [profile]);

  const canChangeAlias = () => {
    if (!profile) return false;
    const changedAt = (profile as any).alias_changed_at;
    if (!changedAt) return true;
    const lastChanged = new Date(changedAt);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return lastChanged <= monthAgo;
  };

  const getDaysUntilAliasChange = () => {
    if (!profile) return 0;
    const changedAt = (profile as any).alias_changed_at;
    if (!changedAt) return 0;
    const nextAllowed = new Date(changedAt);
    nextAllowed.setMonth(nextAllowed.getMonth() + 1);
    const days = Math.ceil((nextAllowed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const handleAliasEdit = () => {
    if (!canChangeAlias()) {
      toast.error(`You can change your name again in ${getDaysUntilAliasChange()} days`);
      return;
    }
    setNewAlias(profile?.alias || '');
    setEditingAlias(true);
  };

  const handleAliasSave = async () => {
    if (!profile || !newAlias.trim()) return;
    if (newAlias.trim().length < 3 || newAlias.trim().length > 30) {
      toast.error('Username must be 3-30 characters');
      return;
    }
    setAliasSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ alias: newAlias.trim(), alias_changed_at: new Date().toISOString() } as any)
      .eq('user_id', profile.user_id);
    if (error) {
      toast.error('Failed to update username');
    } else {
      toast.success('Username updated!');
      await refreshProfile();
    }
    setAliasSaving(false);
    setEditingAlias(false);
  };

  const togglePersonality = (trait: string) => {
    setCharPersonality((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim(),
        region: region || null,
        availability: availability || null,
        character_title: charTitle.trim() || null,
        character_description: charDescription.trim() || null,
        character_personality: charPersonality.length > 0 ? charPersonality : [],
        character_life_story: charLifeStory.trim() || null,
        gender: gender || null,
        emoji_avatar: emojiAvatar,
        interests: selectedInterest ? [selectedInterest] : [],
        primary_language: primaryLanguage,
        secondary_language: secondaryLanguage || null,
        auto_translate_enabled: autoTranslate,
      } as any)
      .eq('user_id', profile.user_id);

    if (error) {
      toast.error('Failed to save');
    } else {
      toast.success('Profile updated!');
      await refreshProfile();
    }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-fade-in">
        {/* Avatar + Alias */}
        <div className="text-center py-8">
          <div className="text-7xl mb-3 relative inline-block">
            {emojiAvatar}
            <OnlineIndicator
              isOnline={profile.is_online ?? true} 
              size="lg" 
              className="absolute -bottom-1 -right-1" 
            />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {editingAlias ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  className="w-40 h-8 text-center text-sm"
                  maxLength={30}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAliasSave} disabled={aliasSaving}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingAlias(false)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <>
                <h2 className="font-heading text-2xl font-bold text-foreground">{profile.alias}</h2>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAliasEdit}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </>
            )}
            <OnlineIndicator isOnline={profile.is_online ?? true} size="md" showLabel lastSeenAt={profile.last_seen_at} />
          </div>
          {!editingAlias && !canChangeAlias() && (
            <p className="text-xs text-muted-foreground mt-1">Name change available in {getDaysUntilAliasChange()} days</p>
          )}
          {gender && <p className="text-sm text-muted-foreground mt-1">{gender}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">Anonymous identity</p>
          <span className="inline-block mt-3 px-4 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {profile.mode_preference === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}
          </span>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/50 text-accent-foreground">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {DAILY_CHAT_LIMIT - chatsUsedToday > 0
                ? `${DAILY_CHAT_LIMIT - chatsUsedToday} chat${DAILY_CHAT_LIMIT - chatsUsedToday !== 1 ? 's' : ''} remaining today`
                : 'No chats remaining today'}
            </span>
          </div>
        </div>

        {/* Emoji Picker */}
        <div className="bg-card rounded-2xl p-6 shadow-card">
          <Label className="mb-2 block">Choose Your Emoji Avatar</Label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setEmojiAvatar(emoji)}
                className={`text-2xl p-2 rounded-xl transition-all ${
                  emojiAvatar === emoji
                    ? 'bg-primary/20 ring-2 ring-primary scale-110'
                    : 'hover:bg-accent'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="bg-card rounded-2xl p-6 shadow-card">
          <Label>Gender</Label>
          <Select value={gender || 'none'} onValueChange={(v) => setGender(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {GENDER_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Interest */}
        <div className="bg-card rounded-2xl p-6 shadow-card">
          <Label className="mb-3 block">What are you looking for?</Label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => setSelectedInterest(selectedInterest === interest ? '' : interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  selectedInterest === interest
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Select one interest</p>
        </div>
        <div className="space-y-4 bg-card rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-heading text-lg font-bold text-foreground">My Character</h3>
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={charTitle}
              onChange={(e) => setCharTitle(e.target.value)}
              placeholder="e.g. The Wandering Poet"
              maxLength={100}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={charDescription}
              onChange={(e) => setCharDescription(e.target.value)}
              placeholder="Describe your character..."
              maxLength={500}
              rows={3}
            />
          </div>

          <div>
            <Label className="mb-2 block">Personality</Label>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_OPTIONS.map((trait) => (
                <Badge
                  key={trait}
                  variant={charPersonality.includes(trait) ? 'default' : 'outline'}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => togglePersonality(trait)}
                >
                  {trait}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Life Story</Label>
            <Textarea
              value={charLifeStory}
              onChange={(e) => setCharLifeStory(e.target.value)}
              placeholder="Share your character's backstory..."
              maxLength={1000}
              rows={4}
            />
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-4 bg-card rounded-2xl p-6 shadow-card">
          <h3 className="font-heading text-lg font-bold text-foreground">Languages</h3>
          <p className="text-xs text-muted-foreground -mt-2">Incoming messages auto-translate into your primary language. Messages already in your secondary language won't be translated.</p>
          <div>
            <Label>Primary Language</Label>
            <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Secondary Language</Label>
            <Select value={secondaryLanguage || 'none'} onValueChange={(v) => setSecondaryLanguage(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {LANGUAGES.filter(l => l.code !== primaryLanguage).map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <Label>Auto-translate recent messages</Label>
              <p className="text-xs text-muted-foreground">Older messages translate on double-tap.</p>
            </div>
            <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} />
          </div>
        </div>

        {/* Edit form */}
        <div className="space-y-4 bg-card rounded-2xl p-6 shadow-card">
          <div>
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself (anonymously)..."
              maxLength={500}
              rows={3}
            />
          </div>
          <div>
            <Label>Country</Label>
          <Select value={region || 'none'} onValueChange={(v) => setRegion(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Availability</Label>
            <Select value={availability || 'none'} onValueChange={(v) => setAvailability(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="When are you available?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {AVAILABILITY_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
