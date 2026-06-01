import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sun, Moon, Trash2, Shield, Volume2, BellRing, HelpCircle, Users } from 'lucide-react';
import BlockedUsersList from '@/components/settings/BlockedUsersList';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SettingsPage = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { mode, setMode } = useMode();
  const { soundEnabled, desktopEnabled, setSoundEnabled, setDesktopEnabled } = useNotifications();
  const navigate = useNavigate();
  const [showAgeVerify, setShowAgeVerify] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleModeSwitch = async (newMode: 'light' | 'dark') => {
    if (newMode === 'dark' && profile?.dark_mode_blocked) {
      navigate('/subscription');
      return;
    }
    if (newMode === 'light' && profile?.light_mode_blocked) {
      toast.error('Your access to Light mode has been restricted by an admin.');
      return;
    }
    if (newMode === 'dark' && !profile?.age_verified) {
      setShowAgeVerify(true);
      return;
    }
    setMode(newMode);
    if (user) {
      await supabase.from('profiles').update({ mode_preference: newMode }).eq('user_id', user.id);
      await refreshProfile();
    }
  };

  const confirmAgeAndSwitch = async () => {
    if (!ageConfirmed || !consentConfirmed) {
      toast.error('Please confirm both checkboxes');
      return;
    }
    if (profile?.dark_mode_blocked) {
      navigate('/subscription');
      setShowAgeVerify(false);
      return;
    }
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
      // Schedule deletion after 24 hours
      const deletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('profiles')
        .update({ scheduled_deletion_at: deletionTime } as any)
        .eq('user_id', user.id);
    }
    await signOut();
    toast.success('Your account will be permanently deleted in 24 hours. Log back in to cancel.');
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-fade-in">
        <h2 className="font-heading text-2xl font-bold text-foreground">Settings</h2>

        {/* Mode switch */}
        <div className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            {mode === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            Experience Mode
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                {mode === 'light' ? '🌞 Light Mode' : '🌑 Dark Mode'}
              </p>
              <p className="text-sm text-muted-foreground">
                {mode === 'light' ? 'Emotional support & friendship' : '18+ romantic connections'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleModeSwitch(mode === 'light' ? 'dark' : 'light')}
            >
              Switch to {mode === 'light' ? '🌑 Dark' : '🌞 Light'}
            </Button>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notifications
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Notification Sound
              </p>
              <p className="text-sm text-muted-foreground">Play a sound for new messages</p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <BellRing className="h-4 w-4" /> Desktop Notifications
              </p>
              <p className="text-sm text-muted-foreground">Show alerts when app is in background</p>
            </div>
            <Switch
              checked={desktopEnabled}
              onCheckedChange={setDesktopEnabled}
            />
        </div>

        {/* Group invitations */}
        <div className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Invitations
          </h3>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium text-foreground">Receive Group Invitations</p>
              <p className="text-sm text-muted-foreground">
                Allow being matched into premium group chats (threesomes & friend circles).
              </p>
            </div>
            <Switch
              checked={!!profile?.receive_group_invites}
              onCheckedChange={async (v) => {
                if (!user) return;
                const { error } = await supabase
                  .from('profiles')
                  .update({ receive_group_invites: v })
                  .eq('user_id', user.id);
                if (error) {
                  toast.error(error.message || 'Could not update setting');
                  return;
                }
                await refreshProfile();
                toast.success(v ? 'Group invitations enabled' : 'Group invitations disabled');
              }}
            />
          </div>
        </div>
        </div>

        {/* Privacy */}
        <div className="bg-card rounded-2xl p-6 shadow-card space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✅ Anonymous username & emoji avatar</li>
            <li>✅ No public profile browsing</li>
            <li>✅ Messages encrypted in database</li>
            <li>✅ Self-destruct chat support</li>
          </ul>
        </div>

        {/* Help & Support — visible on mobile as alternative to floating widget */}
        <div className="bg-card rounded-2xl p-6 shadow-card md:hidden">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Help & Support
            </h3>
            <span className="text-xs text-muted-foreground">{showHelp ? 'Hide' : 'Open'}</span>
          </button>
          {showHelp && (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  // Trigger the help widget by dispatching a custom event
                  window.dispatchEvent(new CustomEvent('open-help-widget'));
                  setShowHelp(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
              >
                📖 FAQ & Contact Support
              </button>
            </div>
          )}
        </div>

        {/* Blocked users */}
        <BlockedUsersList />

        {/* Legal & Info */}
        <div className="bg-card rounded-2xl p-6 shadow-card space-y-2">
          <h3 className="font-heading font-semibold text-foreground mb-3">Information</h3>
          {[
            { label: 'Terms & Conditions', path: '/page/terms' },
            { label: 'Privacy Policy', path: '/page/privacy' },
            { label: 'FAQ', path: '/page/faq' },
            { label: 'Contact Us', path: '/page/contact' },
            { label: 'About Us', path: '/page/about' },
            { label: 'Download App', path: '/download' },
          ].map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Delete account */}
        <div className="bg-card rounded-2xl p-6 shadow-card">
          <h3 className="font-heading font-semibold text-destructive flex items-center gap-2 mb-3">
            <Trash2 className="h-5 w-5" />
            Danger Zone
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
        </div>
      </div>

      {/* Age verification dialog */}
      <Dialog open={showAgeVerify} onOpenChange={setShowAgeVerify}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">🌑 Dark Mode — Age Verification</DialogTitle>
            <DialogDescription>
              Dark Mode contains 18+ content. You must verify your age and consent to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="age"
                checked={ageConfirmed}
                onCheckedChange={(c) => setAgeConfirmed(c === true)}
              />
              <Label htmlFor="age" className="text-sm">
                I confirm I am 18 years of age or older
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consentConfirmed}
                onCheckedChange={(c) => setConsentConfirmed(c === true)}
              />
              <Label htmlFor="consent" className="text-sm">
                I consent to view and participate in 18+ content. All interactions must remain legal and consensual.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgeVerify(false)}>Cancel</Button>
            <Button onClick={confirmAgeAndSwitch} disabled={!ageConfirmed || !consentConfirmed}>
              Enter Dark Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SettingsPage;
