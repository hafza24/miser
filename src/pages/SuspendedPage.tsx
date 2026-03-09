import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, LogOut, Send } from 'lucide-react';
import { toast } from 'sonner';

const SuspendedPage = () => {
  const { user, signOut } = useAuth();
  const [subject, setSubject] = useState('Account Suspension Appeal');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmitAppeal = async () => {
    if (!user || !message.trim()) return;
    if (message.trim().length < 10 || message.trim().length > 1000) {
      toast.error('Please provide an explanation (10-1000 characters)');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim() || 'Account Suspension Appeal',
      message: `**SUSPENSION APPEAL**\n\n${message.trim()}`,
    } as any);
    setSending(false);
    if (error) {
      toast.error('Failed to submit appeal');
    } else {
      setSent(true);
      toast.success('Appeal submitted. We will review your case.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-card p-8 space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Account Suspended</h1>
          <p className="text-muted-foreground text-sm">
            Your account has been suspended due to multiple reports from other users.
            You can submit an appeal to have your account reviewed and potentially restored.
          </p>
        </div>

        {!sent ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="appeal">Explain why your account should be restored</Label>
              <Textarea
                id="appeal"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please explain the situation and why you believe your account should be restored..."
                rows={5}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground mt-1">{message.length}/1000</p>
            </div>
            <Button
              onClick={handleSubmitAppeal}
              disabled={sending || message.trim().length < 10}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Submitting...' : 'Submit Appeal'}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              ✅ Your appeal has been submitted. An admin will review your case and respond via the support system.
            </p>
          </div>
        )}

        <Button variant="outline" onClick={handleSignOut} className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default SuspendedPage;
