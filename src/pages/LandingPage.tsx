import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Heart, Moon } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col gradient-light">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="animate-fade-in space-y-6 max-w-md">
          <div className="text-6xl mb-2">💫</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground leading-tight">
            MrsMrB
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            One Brand. Two Modes. Your Choice.
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            A privacy-first anonymous platform for emotional and romantic connection.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/register')} className="px-8">
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 pb-16 max-w-lg mx-auto w-full space-y-4">
        {[
          { icon: Heart, title: '🌞 Light Mode', desc: 'Emotional support, friendship & soft romance' },
          { icon: Moon, title: '🌑 Dark Mode', desc: '18+ consensual flirting & romantic fantasy' },
          { icon: Shield, title: '🔒 Privacy First', desc: 'Anonymous identity, encrypted chats, no tracking' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-4 bg-card rounded-2xl p-5 shadow-card">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <item.icon className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
        MrsMrB — Privacy. Consent. Connection.
      </footer>
    </div>
  );
};

export default LandingPage;
