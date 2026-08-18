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
    { path: '/app/home', icon: LayoutDashboard, label: 'Home' },
    { path: '/app/chats', icon: MessageCircle, label: 'Chats' },
    { path: '/app/browse', icon: Search, label: 'Browse' },
    { path: '/app/mood-rooms', icon: Sparkles, label: 'Rooms' },
    { path: '/app/profile', icon: User, label: 'Me' },
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
          aria-label="Admin panel"
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
            navigate('/app/premium');
            return;
          }
          toggleMode();
        }}
        className="rounded-full h-9 w-9"
        aria-label="Toggle theme"
      >
        {mode === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/app/settings')}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/app/premium')}>
            <Crown className="mr-2 h-4 w-4" /> Premium
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 h-14 md:h-16 flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SidebarTrigger className="hidden md:flex" />
              <div className="md:hidden">
                <span className="text-2xl">{profile?.emoji_avatar || '💫'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-heading font-bold text-lg md:text-xl truncate md:hidden">Fur&Fir</h1>
                <div className="hidden md:block">
                  <Breadcrumbs />
                </div>
              </div>
            </div>
            {ActionBar}
          </header>

          {/* Main Content */}
          <main className="flex-1 w-full overflow-x-hidden">
            <div className="max-w-5xl mx-auto w-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {children}
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          <nav className="md:hidden sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom pb-safe">
            <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
              {mobileNav.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/app/home' && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <div className="relative">
                      <item.icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
                      {item.path === '/app/chats' && totalUnread > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
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
