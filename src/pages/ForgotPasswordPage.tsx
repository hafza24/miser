import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to send reset email');
    } else {
      setSent(true);
      toast.success('Check your email for a reset link!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-light p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-soft p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {sent ? 'A reset link has been sent to your email.' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                maxLength={255}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Didn't receive it? Check your spam folder or{' '}
            <button onClick={() => setSent(false)} className="text-primary font-medium hover:underline">
              try again
            </button>.
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-medium hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
