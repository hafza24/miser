import { NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Search, UsersRound, User, Settings, Crown, Shield, LayoutDashboard, Sparkles } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';

const mainItems = [
  { path: '/app/home', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/app/chats', icon: MessageCircle, label: 'Chats', badge: 'unread' as const },
  { path: '/app/browse', icon: Search, label: 'Browse' },
  { path: '/app/groups', icon: UsersRound, label: 'Groups' },
  { path: '/app/mood-rooms', icon: Sparkles, label: 'Mood Rooms' },
];

const accountItems = [
  { path: '/app/profile', icon: User, label: 'Profile' },
  { path: '/app/premium', icon: Crown, label: 'Premium' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { isAdmin } = useAdminRole();
  const { totalUnread } = useUnreadCounts();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const renderItem = (item: typeof mainItems[number]) => {
    const active = isActive(item.path);
    return (
      <SidebarMenuItem key={item.label}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
          className="rounded-xl transition-all duration-200 hover:bg-sidebar-accent/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
        >
          <NavLink to={item.path} className="flex items-center w-full px-3 py-2">
            <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            {!collapsed && (
              <span className="ml-3 flex-1 text-sm font-medium tracking-tight">
                {item.label}
              </span>
            )}
            {!collapsed && item.badge === 'unread' && totalUnread > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50 bg-card/30 backdrop-blur-xl">
      <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 text-lg">
            {profile?.emoji_avatar || '💫'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-heading text-base font-bold tracking-tight text-foreground leading-none">Fur&Fir</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-medium truncate uppercase tracking-wider">{profile?.alias}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 gap-6 scrollbar-none">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 font-heading">
            Network
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 font-heading">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{accountItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {isAdmin && !collapsed && (
        <div className="p-4 border-t border-sidebar-border/50">
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10 transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Admin Panel</span>
          </NavLink>
        </div>
      )}
    </Sidebar>
  );
}

