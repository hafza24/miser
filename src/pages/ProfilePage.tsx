import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const ProfilePage = () => {
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState(profile?.bio || '');
  const [region, setRegion] = useState(profile?.region || '');
  const [availability, setAvailability] = useState(profile?.availability || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio.trim(), region: region.trim(), availability: availability.trim() })
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
