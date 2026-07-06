import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Sun, Moon, Trash2, Shield, Volume2, BellRing, HelpCircle, Users,
  Eye, EyeOff, Heart, Globe, Languages as LangIcon, UserCheck,
} from 'lucide-react';
import BlockedUsersList from '@/components/settings/BlockedUsersList';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { COUNTRIES } from '@/lib/countries';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const PRESENCE_OPTIONS: { value: 'online' | 'away' | 'busy' | 'invisible'; label: string; emoji: string; desc: string }[] = [
  { value: 'online',    label: 'Online',    emoji: '🟢', desc: 'Visible and available' },
  { value: 'away',      label: 'Away',      emoji: '🟡', desc: 'Visible, but stepped away' },
  { value: 'busy',      label: 'Busy',      emoji: '🔴', desc: 'Visible, please do not disturb' },
  { value: 'invisible', label: 'Invisible', emoji: '⚫', desc: 'Appear offline to everyone' },
];

const LOOKING_FOR_OPTIONS = [
  { value: 'friendship',  label: 'Friendship',  emoji: '🤝' },
  { value: 'romance',     label: 'Romance',     emoji: '💕' },
  { value: 'networking',  label: 'Networking',  emoji: '🌐' },
  { value: 'study',       label: 'Study',       emoji: '📚' },
  { value: 'gaming',      label: 'Gaming',      emoji: '🎮' },
  { value: 'group_chat',  label: 'Group Chat',  emoji: '👥' },
];

const LANGUAGE_OPTIONS = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ar', 'hi', 'ur', 'bn',
  'zh', 'ja', 'ko', 'tr', 'pl', 'sv', 'fa', 'id',
];

const LOCATION_OPTIONS = [
  { value: 'near_me',       label: 'Near me (same city)' },
  { value: 'same_city',     label: 'Same city' },
  { value: 'same_country',  label: 'Same country' },
  { value: 'worldwide',     label: 'Worldwide' },
];

const SettingsPage = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { mode, setMode } = useMode();
  const { soundEnabled, desktopEnabled, setSoundEnabled, setDesktopEnabled } = useNotifications();
  const navigate = useNavigate();
  const [showAgeVerify, setShowAgeVerify] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Local editable copies for fields that require a save button
  const [country, setCountry] = useState(profile?.country ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? '');
  const [ageMin, setAgeMin] = useState<string>(profile?.age_min?.toString() ?? '');
  const [ageMax, setAgeMax] = useState<string>(profile?.age_max?.toString() ?? '');

  useEffect(() => {
    setCountry(profile?.country ?? '');
    setCity(profile?.city ?? '');
    setAge(profile?.age?.toString() ?? '');
    setAgeMin(profile?.age_min?.toString() ?? '');
    setAgeMax(profile?.age_max?.toString() ?? '');
  }, [profile?.user_id]);

  const updateProfile = async (patch: Record<string, unknown>, successMsg?: string) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(patch as any).eq('user_id', user.id);
    if (error) {
      toast.error(error.message || 'Could not save');
      return;
    }
    await refreshProfile();
    if (successMsg) toast.success(successMsg);
  };


  const toggleLookingFor = async (value: string) => {
    const current = profile?.looking_for ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    await updateProfile({ looking_for: next });
  };

  const toggleLanguage = async (lang: string) => {
    const current = profile?.preferred_languages ?? [];
    const next = current.includes(lang) ? current.filter((v) => v !== lang) : [...current, lang];
    await updateProfile({ preferred_languages: next });
  };

  const saveLocation = async () => {
    const trimmedCountry = country.trim().slice(0, 80) || null;
    const trimmedCity = city.trim().slice(0, 80) || null;
    await updateProfile({ country: trimmedCountry, city: trimmedCity }, 'Location saved');
  };

  const saveAges = async () => {
    const parsed = (v: string): number | null => {
      if (!v.trim()) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 18 || n > 120) return NaN as unknown as number;
      return Math.floor(n);
    };
    const a = parsed(age);
    const aMin = parsed(ageMin);
    const aMax = parsed(ageMax);
    if ([a, aMin, aMax].some((v) => Number.isNaN(v as number))) {
      toast.error('Ages must be between 18 and 120');
      return;
    }
    if (aMin != null && aMax != null && aMin > aMax) {
      toast.error('Minimum age cannot be greater than maximum');
      return;
    }
    await updateProfile({ age: a, age_min: aMin, age_max: aMax }, 'Ages saved');
  };

  const handleModeSwitch = async (newMode: 'light' | 'dark') => {
    if (newMode === 'dark' && profile?.dark_mode_blocked) { navigate('/subscription'); return; }
    if (newMode === 'light' && profile?.light_mode_blocked) { toast.error('Your access to Light mode has been restricted by an admin.'); return; }
    if (newMode === 'dark' && !profile?.age_verified) { setShowAgeVerify(true); return; }
    setMode(newMode);
    if (user) {
      await supabase.from('profiles').update({ mode_preference: newMode }).eq('user_id', user.id);
      await refreshProfile();
    }
  };

  const confirmAgeAndSwitch = async () => {
    if (!ageConfirmed || !consentConfirmed) { toast.error('Please confirm both checkboxes'); return; }
    if (profile?.dark_mode_blocked) { navigate('/subscription'); setShowAgeVerify(false); return; }
    if (user) {
      await supabase.from('profiles').update({ age_verified: true, mode_preference: 'dark' }).eq('user_id', user.id);
      await refreshProfile();
    }
    setMode('dark');
    setShowAgeVerify(false);
    toast.success('Welcome to Dark Mode');
  };

  const handleDeleteAccount = async () => {
    if (user) {
      const deletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({ scheduled_deletion_at: deletionTime } as any).eq('user_id', user.id);
    }
    await signOut();
    toast.success('Your account will be permanently deleted in 24 hours. Log back in to cancel.');
    navigate('/');
  };

  if (!profile) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Loading…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-fade-in pb-12">
        <h2 className="font-heading text-2xl font-bold text-foreground">Settings</h2>

        {/* Presence Status */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Presence
          </h3>
          <p className="text-xs text-muted-foreground">How others see your activity status.</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESENCE_OPTIONS.map((opt) => {
              const active = profile.presence_status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateProfile({ presence_status: opt.value }, `Status set to ${opt.label}`)}
                  className={`text-left p-3 rounded-xl border transition-all ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                >
                  <div className="font-medium text-sm text-foreground">{opt.emoji} {opt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Discovery controls */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5" /> Discovery
          </h3>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium text-foreground">Pause profile</p>
              <p className="text-sm text-muted-foreground">Temporarily stop appearing in browse and matches.</p>
            </div>
            <Switch
              checked={profile.profile_paused}
              onCheckedChange={(v) => updateProfile({ profile_paused: v }, v ? 'Profile paused' : 'Profile active')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium text-foreground flex items-center gap-2"><EyeOff className="h-4 w-4" /> Hide from discovery</p>
              <p className="text-sm text-muted-foreground">Existing chats keep working; you just won't appear to new people.</p>
            </div>
            <Switch
              checked={profile.hidden_from_discovery}
              onCheckedChange={(v) => updateProfile({ hidden_from_discovery: v }, v ? 'Hidden from discovery' : 'Visible in discovery')}
            />
          </div>
        </section>


        {/* Preferred languages */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <LangIcon className="h-5 w-5" /> Preferred languages
          </h3>
          <p className="text-xs text-muted-foreground">Match people you can talk to.</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((lang) => {
              const active = (profile.preferred_languages ?? []).includes(lang);
              return (
                <Badge
                  key={lang}
                  variant={active ? 'default' : 'outline'}
                  className="cursor-pointer select-none text-xs px-3 py-1"
                  onClick={() => toggleLanguage(lang)}
                >
                  {lang.toUpperCase()}
                </Badge>
              );
            })}
          </div>
        </section>

        {/* Mode switch */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            {mode === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />} Experience Mode
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{mode === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}</p>
              <p className="text-sm text-muted-foreground">{mode === 'light' ? 'Emotional support & friendship' : '18+ romantic connections'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleModeSwitch(mode === 'light' ? 'dark' : 'light')}>
              Switch to {mode === 'light' ? '🌑 Dark' : '🌞 Light'}
            </Button>
          </div>
        </section>

        {/* Notification preferences */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Notifications
          </h3>

          <div className="flex items-center justify-between">
            <div><p className="font-medium text-foreground flex items-center gap-2"><Volume2 className="h-4 w-4" /> Sound</p>
              <p className="text-sm text-muted-foreground">Play a sound for new messages</p></div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div><p className="font-medium text-foreground flex items-center gap-2"><BellRing className="h-4 w-4" /> Desktop alerts</p>
              <p className="text-sm text-muted-foreground">Browser notifications when app is backgrounded</p></div>
            <Switch checked={desktopEnabled} onCheckedChange={setDesktopEnabled} />
          </div>

          <div className="h-px bg-border my-2" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notify me about</p>

          {[
            { key: 'notify_messages',           label: 'Messages',           desc: 'New messages in your chats' },
            { key: 'notify_requests',           label: 'Chat requests',      desc: 'Someone wants to start a chat' },
            { key: 'notify_matches',            label: 'Matches',            desc: 'New compatible people found' },
            { key: 'notify_group_invites_pref', label: 'Group invitations',  desc: 'Premium group chat invites' },
            { key: 'notify_mentions',           label: 'Mentions',           desc: 'When someone mentions you' },
            { key: 'notify_expiry',             label: 'Chat expiry',        desc: 'Heads up before a chat disappears' },
            { key: 'notify_marketing',          label: 'Updates & tips',     desc: 'Product news and announcements' },
          ].map((row) => (
            <div className="flex items-center justify-between" key={row.key}>
              <div className="pr-4">
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="text-sm text-muted-foreground">{row.desc}</p>
              </div>
              <Switch
                checked={Boolean((profile as any)[row.key])}
                onCheckedChange={(v) => updateProfile({ [row.key]: v })}
              />
            </div>
          ))}
        </section>

        {/* Group invitations (existing) */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" /> Group Invitations
          </h3>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium text-foreground">Receive Group Invitations</p>
              <p className="text-sm text-muted-foreground">Allow being matched into premium group chats.</p>
            </div>
            <Switch
              checked={!!profile.receive_group_invites}
              onCheckedChange={(v) => updateProfile({ receive_group_invites: v }, v ? 'Group invitations enabled' : 'Group invitations disabled')}
            />
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5" /> Privacy
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✅ Anonymous username & emoji avatar</li>
            <li>✅ No public profile browsing</li>
            <li>✅ Messages encrypted in database</li>
            <li>✅ Self-destruct chat support</li>
          </ul>
        </section>

        {/* Help & Support — mobile only */}
        <section className="bg-card rounded-2xl p-6 shadow-card md:hidden">
          <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center justify-between">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-5 w-5" /> Help & Support
            </h3>
            <span className="text-xs text-muted-foreground">{showHelp ? 'Hide' : 'Open'}</span>
          </button>
          {showHelp && (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { window.dispatchEvent(new CustomEvent('open-help-widget')); setShowHelp(false); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
              >📖 FAQ & Contact Support</button>
            </div>
          )}
        </section>

        <BlockedUsersList />

        {/* Legal & Info */}
        <section className="bg-card rounded-2xl p-6 shadow-card space-y-2">
          <h3 className="font-heading font-semibold text-foreground mb-3">Information</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Terms & Conditions', path: '/page/terms' },
              { label: 'Privacy Policy',     path: '/page/privacy' },
              { label: 'FAQ',                path: '/page/faq' },
              { label: 'Contact Us',         path: '/page/contact' },
              { label: 'About Us',           path: '/page/about' },
              { label: 'Download App',       path: '/download' },
            ].map((link) => (
              <button key={link.path} onClick={() => navigate(link.path)} className="px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors border border-border">
                {link.label}
              </button>
            ))}
          </div>
        </section>

        {/* Delete */}
        <section className="bg-card rounded-2xl p-6 shadow-card">
          <h3 className="font-heading font-semibold text-destructive flex items-center gap-2 mb-3">
            <Trash2 className="h-5 w-5" /> Danger Zone
          </h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your account will be scheduled for deletion in 24 hours. You can cancel by logging back in before then.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>Delete Everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>

      <Dialog open={showAgeVerify} onOpenChange={setShowAgeVerify}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">🌑 Dark Mode — Age Verification</DialogTitle>
            <DialogDescription>Dark Mode contains 18+ content. You must verify your age and consent to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <Checkbox id="age" checked={ageConfirmed} onCheckedChange={(c) => setAgeConfirmed(c === true)} />
              <Label htmlFor="age" className="text-sm">I confirm I am 18 years of age or older</Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="consent" checked={consentConfirmed} onCheckedChange={(c) => setConsentConfirmed(c === true)} />
              <Label htmlFor="consent" className="text-sm">I consent to view and participate in 18+ content. All interactions must remain legal and consensual.</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgeVerify(false)}>Cancel</Button>
            <Button onClick={confirmAgeAndSwitch} disabled={!ageConfirmed || !consentConfirmed}>Enter Dark Mode</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SettingsPage;
