import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Moon, Upload, CheckCircle, Clock, XCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const UnlockDarkModePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [method, setMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExisting = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setExistingRequest(data[0]);
      }
      setLoading(false);
    };
    loadExisting();
  }, [user]);

  // If dark mode is already unlocked, redirect
  useEffect(() => {
    if (!loading && profile && !profile.dark_mode_blocked) {
      navigate('/dashboard');
    }
  }, [loading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !method || !screenshot) {
      toast.error('Please fill all required fields and upload a screenshot');
      return;
    }

    setSubmitting(true);
    try {
      // Upload screenshot
      const fileExt = screenshot.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, screenshot);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(filePath);

      // Create payment request
      const { error } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        name: name.trim(),
        method,
        transaction_id: transactionId.trim() || null,
        screenshot_url: urlData.publicUrl,
        status: 'pending',
      });

      if (error) throw error;

      // Update profile payment_status
      await supabase
        .from('profiles')
        .update({ payment_status: 'pending' } as any)
        .eq('user_id', user.id);
      await refreshProfile();

      toast.success('Payment proof submitted! We will review it shortly.');
      // Reload existing request
      const { data } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setExistingRequest(data[0]);
    } catch (err: any) {
      toast.error('Failed to submit: ' + (err.message || 'Unknown error'));
    }
    setSubmitting(false);
  };

  const paymentStatus = (existingRequest as any)?.status || (profile as any)?.payment_status || 'none';

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Moon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            🌑 Unlock Dark Mode
          </h1>
          <p className="text-muted-foreground mt-2">
            Dark Mode is a premium feature with 18+ content
          </p>
        </div>

        {/* Pricing card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center">
            <p className="text-4xl font-bold text-foreground mb-1">$0.5</p>
            <p className="text-sm text-muted-foreground">One-time payment</p>
            <div className="mt-4 space-y-2 text-sm text-foreground">
              <p>✨ Unlimited Dark Mode access</p>
              <p>🔥 Flirting & Passionate Romance</p>
              <p>✨ Fantasy Roleplay</p>
              <p>🌙 18+ exclusive content</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment details */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-heading font-semibold text-foreground">Payment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium text-foreground">0.5 USD (or equivalent PKR)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Methods:</span>
                <span className="font-medium text-foreground">JazzCash · EasyPaisa · Nayapay</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account:</span>
                <span className="font-medium text-foreground">03016912786</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium text-foreground">Asim Azeemi</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status messages */}
        {paymentStatus === 'pending' && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Payment Under Review</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your payment is being verified. Dark Mode will be unlocked once confirmed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentStatus === 'approved' && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Payment Verified!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dark Mode has been unlocked for your account. Enjoy the full experience.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentStatus === 'rejected' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Payment Rejected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your payment could not be verified. Please submit again with a valid screenshot.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment form - show when no pending request or rejected */}
        {paymentStatus !== 'pending' && paymentStatus !== 'approved' && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-foreground mb-4">Submit Payment Proof</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method *</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JazzCash">JazzCash</SelectItem>
                      <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                      <SelectItem value="Nayapay">Nayapay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="txid">Transaction ID (optional)</Label>
                  <Input
                    id="txid"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. TXN12345678"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="screenshot">Payment Screenshot *</Label>
                  <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                    <input
                      id="screenshot"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="screenshot" className="cursor-pointer">
                      {screenshot ? (
                        <div className="flex items-center gap-2 justify-center text-foreground">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{screenshot.name}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload payment screenshot
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default UnlockDarkModePage;
