import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Heart, Moon, Sparkles, ArrowRight, MessageCircle, Users, Lock, Download, ChevronDown } from 'lucide-react';

const ROTATING_WORDS = ['understands you', 'gets your vibe', 'feels the same', 'truly connects'];

const LandingPage = () => {
  const navigate = useNavigate();
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const current = ROTATING_WORDS[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayed.length < current.length) {
        timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 70);
      } else {
        timeout = setTimeout(() => setPhase('pausing'), 1400);
      }
    } else if (phase === 'pausing') {
      timeout = setTimeout(() => setPhase('deleting'), 200);
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length - 1)), 35);
      } else {
        setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, phase, wordIndex]);

  // Reveal FAQ cards on scroll
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
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
          <div className="primary-subtitle">
            Privacy-first anonymous connections
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
            Find someone who
            <span className="block gradient-hero bg-clip-text text-transparent min-h-[1.1em]">
              {displayed}
              <span className="inline-block w-[2px] h-[0.9em] align-middle bg-primary ml-1 animate-pulse" aria-hidden="true" />
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            The safe, anonymous space for emotional connection and romantic exploration. Two modes, one purpose real human connection.
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
              { icon: Users, title: 'Create Profile', desc: 'Pick a playful emoji, choose your alias, and set the vibe that feels right for you. No real names, no photos, no pressure — you stay completely anonymous from the very first moment you join.' },
              { icon: Heart, title: 'Choose Your Mode', desc: 'Switch between Light mode for friendship, emotional support and soft romance, or Dark mode for adults-only flirting and passionate roleplay. Your mode, your rules — change it whenever your mood shifts.' },
              { icon: MessageCircle, title: 'Start Chatting', desc: 'Get matched with people who share your interests, language and energy. Break the ice instantly, build real connection, and enjoy safe conversations with auto-delete and full block controls always at hand.' },
            ].map((item, i) => (
              <div
                key={item.title}
                data-reveal
                style={{ transitionDelay: `${i * 200}ms` }}
                className="reveal-on-scroll relative bg-card rounded-2xl p-6 shadow-card border border-border text-center group hover:shadow-soft hover:-translate-y-1 transition-all duration-300"
              >
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

      {/* FAQ */}
      <section id="faq" className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/40 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="primary-subtitle mb-4">FAQ</div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Everything you need to know before joining Fur&amp;Fir
            </p>
          </div>

          <div className="space-y-3">
            {[
              { q: 'Is Fur&Fir really anonymous?', a: 'Yes. You sign up with just an email and use an emoji + alias. Your real identity is never shown to other users, and we don\'t track conversations for advertising.' },
              { q: 'What is the difference between Light and Dark mode?', a: 'Light mode is for friendship, emotional support, and soft romance. Dark mode is an adults-only space for flirting, passionate romance, and fantasy roleplay. You can switch anytime, but interactions stay isolated per mode.' },
              { q: 'How much does it cost?', a: 'Fur&Fir is free to start. Premium features (like Dark Mode and higher daily limits) require a subscription with a 7-day free trial. Payment is manual via JazzCash / EasyPaisa with proof approval.' },
              { q: 'Are my chats private and secure?', a: 'Chats are protected end-to-end and can be set to auto-delete after 24 hours. View-once media disappears after viewing. We enforce strict row-level security on all data.' },
              { q: 'Can I block or report someone?', a: 'Yes. Bidirectional blocking hides both users from each other instantly. Reports are reviewed by admins, and repeated violations trigger auto-suspension.' },
              { q: 'Is there a mobile app?', a: 'Yes — install Fur&Fir as a PWA from the Download page, or grab the Android APK. Both support push notifications for matches and messages.' },
              { q: 'How do I cancel my subscription?', a: 'You can cancel anytime from the Subscription page. Your premium features remain active until the end of the current billing period.' },
            ].map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  data-reveal
                  style={{ transitionDelay: `${i * 80}ms` }}
                  className="reveal-on-scroll group bg-card rounded-2xl border border-border shadow-card hover:border-primary/40 transition-colors overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left font-heading font-semibold text-foreground text-base"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`h-5 w-5 text-primary flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-foreground transition-colors">About</button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-foreground transition-colors">FAQ</button>
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
