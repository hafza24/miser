import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const calcAge = (dobStr: string): number => {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return NaN;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Max DOB = today minus 18 years (used to constrain the date picker)
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) {
      toast.error('Please enter your date of birth');
      return;
    }
    const age = calcAge(dob);
    if (isNaN(age) || age < 18) {
      toast.error('You must be 18 or older to join Fur&Fir. Account creation blocked.');
      return;
    }
    if (age > 120) {
      toast.error('Please enter a valid date of birth');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password, age);
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already been registered')) {
        toast.error('An account with this email already exists. Please sign in instead.');
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } else {
      if (rememberMe) {
        localStorage.setItem('mrsmrb_saved_email', email.trim());
      }
      toast.success('Check your email for a verification link!');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-light p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-soft p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground">Join Fur&amp;Fir ✨</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create your anonymous identity in seconds</p>
        </div>

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
          <div>
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={maxDob}
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">You must be 18+ to join.</p>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              minLength={6}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="rememberMe" className="text-sm cursor-pointer">Remember Me</Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
