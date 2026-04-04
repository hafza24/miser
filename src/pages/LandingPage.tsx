import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Heart, Moon, Sparkles, ArrowRight, MessageCircle, Users, Lock, Download, ChevronDown } from 'lucide-react';

const ROTATING_WORDS = ['understands you', 'gets your vibe', 'feels the same', 'truly connects'];

const LandingPage = () => {
  const navigate = useNavigate();
  const [wordIndex, setWordIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
        setFade(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-heading text-xl font-bold text-foreground">Fur&amp;Fir</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="text-sm">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/register')} className="rounded-full text-sm px-5">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24 text-center">
        {/* Gradient orbs */}
        <div className="absolute top-10 left-[10%] w-64 sm:w-80 h-64 sm:h-80 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-10 right-[10%] w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-accent/25 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[100px] pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-xl w-full">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Privacy-first anonymous connections
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
            Find someone who
            <span
              className={`block gradient-hero bg-clip-text text-transparent transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
            >
              {ROTATING_WORDS[wordIndex]}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            The safe, anonymous space for emotional connection and romantic exploration. Two modes, one purpose — <strong className="text-foreground">real human connection.</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 h-12 text-base font-semibold rounded-full gap-2 shadow-soft hover:scale-[1.03] active:scale-[0.98] transition-transform"
            >
              Start Connecting
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 h-12 text-base rounded-full hover:scale-[1.03] active:scale-[0.98] transition-transform border-2"
            >
              Sign In
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => navigate('/download')}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Download App
          </Button>
        </div>

        <button
          onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-2">
            How It Works
          </h2>
          <p className="text-center text-muted-foreground mb-10 sm:mb-12 max-w-md mx-auto">
            Three simple steps to meaningful connections
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {[
              { step: '01', icon: Users, title: 'Create Profile', desc: 'Pick your emoji, set your vibe. Stay completely anonymous.' },
              { step: '02', icon: Heart, title: 'Choose Your Mode', desc: 'Light for friendship & support. Dark for romance & flirting.' },
              { step: '03', icon: MessageCircle, title: 'Start Chatting', desc: 'Match by interests and connect with people who get you.' },
            ].map((item) => (
              <div key={item.step} className="relative bg-card rounded-2xl p-6 shadow-card border border-border text-center group hover:shadow-soft hover:-translate-y-1 transition-all duration-300">
                <span className="text-4xl font-heading font-bold text-primary/10 absolute top-3 right-4 select-none">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
            Two Modes. Your Choice.
          </h2>
          <p className="text-center text-muted-foreground mb-10 sm:mb-12 max-w-md mx-auto">
            Switch between modes anytime based on your mood
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {/* Light */}
            <div className="rounded-2xl border-2 border-border p-6 sm:p-8 bg-card shadow-card hover:border-primary/50 hover:shadow-soft transition-all duration-300 group">
              <div className="text-5xl mb-4">🌞</div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Light Mode</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                A warm space for emotional support, building friendships, and exploring soft romance.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Emotional Support', 'Friendship', 'Cute Love'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Dark */}
            <div className="rounded-2xl border-2 border-border p-6 sm:p-8 bg-card shadow-card hover:border-primary/50 hover:shadow-soft transition-all duration-300 group">
              <div className="text-5xl mb-4">🌑</div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Dark Mode</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                An adults-only space for consensual flirting, passionate romance, and fantasy roleplay.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Flirting', 'Passionate Romance', 'Fantasy Roleplay'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/40">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
            Built on Trust
          </h2>
          <div className="space-y-4">
            {[
              { icon: Shield, title: 'Privacy First', desc: 'Anonymous identity, no tracking. Your conversations stay yours.' },
              { icon: Lock, title: 'Encrypted Chats', desc: 'End-to-end protection. Messages auto-delete for extra safety.' },
              { icon: Heart, title: 'Consent Always', desc: 'Both modes enforce mutual respect and consent at every step.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 bg-card rounded-2xl p-5 shadow-card border border-border hover:shadow-soft transition-shadow duration-300">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground text-base">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="max-w-md mx-auto space-y-5 relative z-10">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            Ready to connect?
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Join thousands finding real, meaningful connections anonymously.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/register')}
            className="w-full sm:w-auto px-10 h-12 text-base font-semibold rounded-full gap-2 shadow-soft hover:scale-[1.03] active:scale-[0.98] transition-transform"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 bg-card/50">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-heading font-bold text-foreground">Fur&amp;Fir</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => navigate('/page/about')} className="hover:text-foreground transition-colors">About</button>
            <button onClick={() => navigate('/page/faq')} className="hover:text-foreground transition-colors">FAQ</button>
            <button onClick={() => navigate('/page/privacy')} className="hover:text-foreground transition-colors">Privacy</button>
            <button onClick={() => navigate('/page/terms')} className="hover:text-foreground transition-colors">Terms</button>
            <button onClick={() => navigate('/page/contact')} className="hover:text-foreground transition-colors">Contact</button>
          </div>
          <span className="text-xs text-muted-foreground">© 2026 Fur&amp;Fir by Busistree</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
