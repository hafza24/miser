import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Heart, Moon, Sparkles, ArrowRight, MessageCircle, Users, Lock } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="animate-fade-in space-y-8 max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Privacy-first anonymous connections
          </div>

          <h1 className="font-heading text-5xl sm:text-6xl font-bold text-foreground leading-tight tracking-tight">
            Find someone who
            <span className="block bg-clip-text text-transparent gradient-hero">understands you</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Fur&amp;Fir is the safe, anonymous space for emotional connection and romantic exploration. Two modes, one purpose — <strong className="text-foreground">real human connection.</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="px-8 h-12 text-base font-semibold rounded-full gap-2 shadow-soft hover:scale-[1.02] transition-transform"
            >
              Start Connecting
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/login')}
              className="px-8 h-12 text-base rounded-full hover:scale-[1.02] transition-transform"
            >
              Sign In
            </Button>
          </div>

          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/download')}
            className="px-8 h-12 text-base rounded-full gap-2 hover:scale-[1.02] transition-transform"
          >
            📲 Download App
          </Button>
        </div>
      </div>

      {/* How It Works */}
      <div className="px-4 py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
            How Fur&amp;Fir Works
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            Three simple steps to meaningful connections
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: '01', icon: Users, title: 'Create Profile', desc: 'Pick your emoji, set your vibe. Stay completely anonymous.' },
              { step: '02', icon: Heart, title: 'Choose Your Mode', desc: 'Light for friendship & support. Dark for romance & flirting.' },
              { step: '03', icon: MessageCircle, title: 'Start Chatting', desc: 'Match by interests and connect with people who get you.' },
            ].map((item) => (
              <div key={item.step} className="relative bg-card rounded-2xl p-6 shadow-card border border-border text-center group hover:shadow-soft transition-shadow">
                <span className="text-4xl font-heading font-bold text-primary/15 absolute top-3 right-4">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modes Section */}
      <div className="px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
            Two Modes. Your Choice.
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Light Mode Card */}
            <div className="rounded-2xl border-2 border-border p-6 bg-card shadow-card hover:border-primary/40 hover:shadow-soft transition-all group">
              <div className="text-4xl mb-4">🌞</div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Light Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                A warm space for emotional support, building friendships, and exploring soft romance.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Emotional Support', 'Friendship', 'Cute Love'].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Dark Mode Card */}
            <div className="rounded-2xl border-2 border-border p-6 bg-card shadow-card hover:border-primary/40 hover:shadow-soft transition-all group">
              <div className="text-4xl mb-4">🌑</div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Dark Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                An adults-only space for consensual flirting, passionate romance, and fantasy roleplay.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Flirting', 'Passionate Romance', 'Fantasy Roleplay'].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="px-4 py-16 bg-muted/30">
        <div className="max-w-lg mx-auto space-y-4">
          {[
            { icon: Shield, title: 'Privacy First', desc: 'Anonymous identity, no tracking. Your conversations stay yours.' },
            { icon: Lock, title: 'Encrypted Chats', desc: 'End-to-end protection. Messages auto-delete for extra safety.' },
            { icon: Heart, title: 'Consent Always', desc: 'Both modes enforce mutual respect and consent at every step.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4 bg-card rounded-2xl p-5 shadow-card border border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="px-4 py-16 text-center">
        <div className="max-w-md mx-auto space-y-6">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            Ready to connect?
          </h2>
          <p className="text-muted-foreground">
            Join thousands of people finding real, meaningful connections anonymously.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/register')}
            className="px-10 h-12 text-base font-semibold rounded-full gap-2 shadow-soft hover:scale-[1.02] transition-transform"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <button onClick={() => navigate('/page/about')} className="hover:text-foreground transition-colors">About</button>
          <button onClick={() => navigate('/page/faq')} className="hover:text-foreground transition-colors">FAQ</button>
          <button onClick={() => navigate('/page/privacy')} className="hover:text-foreground transition-colors">Privacy</button>
          <button onClick={() => navigate('/page/terms')} className="hover:text-foreground transition-colors">Terms</button>
          <button onClick={() => navigate('/page/contact')} className="hover:text-foreground transition-colors">Contact</button>
          <button onClick={() => navigate('/download')} className="hover:text-foreground transition-colors">Download</button>
          <span className="w-full text-center mt-3 opacity-60">© 2026 Fur&amp;Fir by Busistree</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
