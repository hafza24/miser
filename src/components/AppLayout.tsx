import React from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, MessageCircle, User, Settings, LogOut, Search, Shield, UsersRound, LayoutDashboard, Sparkles, Crown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAdminRole } from '@/hooks/useAdminRole';
import NotificationDropdown from '@/components/NotificationDropdown';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { mode, toggleMode } = useMode();
  const { profile, signOut } = useAuth();
  const { totalUnread } = useUnreadCounts();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();

  const mobileNav = [
    { path: '/dashboard', icon: MessageCircle, label: 'Chats' },
    { path: '/browse', icon: Search, label: 'Browse' },
    { path: '/mood-rooms', icon: Sparkles, label: 'Mood Rooms' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const ActionBar = (
    <div className="flex items-center gap-1 sm:gap-2">
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
          className="rounded-full h-9 w-9 md:hidden"
          aria-label="Open admin panel"
          title="Admin Panel"
        >
          <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
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
        aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        title={mode === 'light' ? 'Switch to dark' : 'Switch to light'}
      >
        {mode === 'light'
          ? <Moon className="h-4 w-4" aria-hidden="true" />
          : <Sun className="h-4 w-4" aria-hidden="true" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        className="rounded-full h-9 w-9"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex sticky top-0 z-40 h-14 items-center gap-3 border-b border-border bg-card/90 backdrop-blur-lg px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-6 w-px bg-border" />
            <Breadcrumbs />
            <div className="ml-auto">{ActionBar}</div>
          </header>

          {/* Mobile top bar */}
          <header className="md:hidden sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-lg px-4 py-2.5">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 min-w-0 rounded-lg"
                aria-label="Go to dashboard"
              >
                <span className="text-2xl flex-shrink-0" aria-hidden="true">{profile?.emoji_avatar || '💫'}</span>
                <div className="min-w-0 text-left">
                  <span className="font-heading text-lg font-bold text-foreground leading-none block">Fur&amp;Fir</span>
                  <span className="text-xs text-muted-foreground truncate block">{profile?.alias}</span>
                </div>
              </button>
              {ActionBar}
            </div>
          </header>

          <a href="#main-content" className="skip-link">Skip to content</a>

          {/* Content */}
          <main id="main-content" role="main" className="flex-1 w-full">
            <div className="max-w-5xl mx-auto w-full px-0 md:px-6 md:py-6">{children}</div>
          </main>

          {/* Mobile bottom nav */}
          <nav
            aria-label="Primary"
            className="md:hidden sticky bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg safe-area-bottom"
          >
            <div className="max-w-2xl mx-auto flex justify-around py-1.5 sm:py-2">
              {mobileNav.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 min-h-11 rounded-lg transition-colors relative ${
                      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="relative">
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                      {item.path === '/dashboard' && totalUnread > 0 && (
                        <span
                          className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
                          aria-label={`${totalUnread} unread`}
                        >
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
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
