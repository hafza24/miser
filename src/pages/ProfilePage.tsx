import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageCircle, Sparkles } from 'lucide-react';

const DAILY_CHAT_LIMIT = 3;

const PERSONALITY_OPTIONS = [
  'Kind', 'Rude', 'Romantic', 'Emotional', 'Friendly',
  'Mysterious', 'Funny', 'Shy', 'Bold', 'Caring',
  'Sarcastic', 'Adventurous', 'Calm', 'Energetic', 'Wise',
];

const ProfilePage = () => {
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState(profile?.bio || '');
  const [region, setRegion] = useState(profile?.region || '');
  const [availability, setAvailability] = useState(profile?.availability || '');
  const [saving, setSaving] = useState(false);
  const [chatsUsedToday, setChatsUsedToday] = useState(0);

  // Character fields
  const [charTitle, setCharTitle] = useState(profile?.character_title || '');
  const [charDescription, setCharDescription] = useState(profile?.character_description || '');
  const [charPersonality, setCharPersonality] = useState<string[]>(profile?.character_personality || []);
  const [charLifeStory, setCharLifeStory] = useState(profile?.character_life_story || '');

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setRegion(profile.region || '');
      setAvailability(profile.availability || '');
      setCharTitle(profile.character_title || '');
      setCharDescription(profile.character_description || '');
      setCharPersonality(profile.character_personality || []);
      setCharLifeStory(profile.character_life_story || '');
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
        region: region.trim(),
        availability: availability.trim(),
        character_title: charTitle.trim() || null,
        character_description: charDescription.trim() || null,
        character_personality: charPersonality.length > 0 ? charPersonality : [],
        character_life_story: charLifeStory.trim() || null,
      })
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
          <div className="text-7xl mb-3">{profile.emoji_avatar}</div>
          <h2 className="font-heading text-2xl font-bold text-foreground">{profile.alias}</h2>
          <p className="text-sm text-muted-foreground mt-1">Anonymous identity</p>
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

        {/* Character Section */}
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
            <Label>Region</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Europe, Asia"
              maxLength={100}
            />
          </div>
          <div>
            <Label>Availability</Label>
            <Input
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g. Evenings, Weekends"
              maxLength={100}
            />
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
