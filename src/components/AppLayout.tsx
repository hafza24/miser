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
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
            <span className="text-2xl">{profile?.emoji_avatar || '💫'}</span>
            <div>
              <span className="font-heading text-lg font-bold text-foreground leading-none">Fur&amp;Fir</span>
              <span className="text-xs text-muted-foreground">{profile?.alias}</span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
                className="rounded-full"
                title="Admin Panel"
              >
                <Shield className="h-5 w-5 text-primary" />
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
              className="rounded-full"
            >
              {mode === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-full">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 z-50 border-t border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex justify-around py-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors relative ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.path === '/dashboard' && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
