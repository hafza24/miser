import React from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, MessageCircle, User, Settings, LogOut, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAdminRole } from '@/hooks/useAdminRole';
import NotificationDropdown from '@/components/NotificationDropdown';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { mode, toggleMode } = useMode();
  const { profile, signOut } = useAuth();
  const { totalUnread } = useUnreadCounts();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: MessageCircle, label: 'Chats' },
    { path: '/browse', icon: Search, label: 'Browse' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-lg px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{profile?.emoji_avatar || '💫'}</span>
            <div className="min-w-0">
              <span className="font-heading text-lg font-bold text-foreground leading-none block">Fur&amp;Fir</span>
              <span className="text-xs text-muted-foreground truncate block">{profile?.alias}</span>
            </div>
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
                className="rounded-full h-9 w-9"
                title="Admin Panel"
              >
                <Shield className="h-4 w-4 text-primary" />
              </Button>
            )}
            <NotificationDropdown />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (mode === 'light' && profile?.dark_mode_blocked) {
                  navigate('/subscription');
                  return;
                }
                toggleMode();
              }}
              className="rounded-full h-9 w-9"
            >
              {mode === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-full h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-50 border-t border-border bg-card/90 backdrop-blur-lg safe-area-bottom">
        <div className="max-w-2xl mx-auto flex justify-around py-1.5 sm:py-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 rounded-lg transition-colors relative ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.path === '/dashboard' && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-medium">{item.label}</span>
                {active && <div className="absolute -bottom-1.5 w-6 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
