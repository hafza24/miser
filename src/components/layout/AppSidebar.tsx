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
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chats', icon: MessageCircle, label: 'Chats', badge: 'unread' as const },
  { path: '/browse', icon: Search, label: 'Browse' },
  { path: '/groups', icon: UsersRound, label: 'Groups' },
  { path: '/mood-rooms', icon: Sparkles, label: 'Mood Rooms' },
];

const accountItems = [
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/subscription', icon: Crown, label: 'Premium' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { isAdmin } = useAdminRole();
  const { totalUnread } = useUnreadCounts();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const itemClass =
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 font-medium transition-all hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:backdrop-blur-sm data-[active=true]:shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.4),inset_0_1px_0_0_hsl(var(--primary)/0.15)] data-[active=true]:ring-1 data-[active=true]:ring-primary/15";

  const renderItem = (item: typeof mainItems[number]) => {
    const active = isActive(item.path);
    return (
      <SidebarMenuItem key={item.label}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={itemClass}>
          <NavLink to={item.path}>
            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
            {!collapsed && <span className="flex-1 text-[14px]">{item.label}</span>}
            {!collapsed && item.badge === 'unread' && totalUnread > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
            {!collapsed && active && !item.badge && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const groupLabelClass =
    "px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40 font-heading";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.5)] text-lg">
            {profile?.emoji_avatar || '💫'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-heading text-base font-bold leading-tight tracking-tight">Fur&amp;Fir</div>
              <div className="text-[11px] text-muted-foreground truncate">{profile?.alias}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 gap-6">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className={groupLabelClass}>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className={groupLabelClass}>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{accountItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className={groupLabelClass}>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/admin')}
                    tooltip="Admin Panel"
                    className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-primary/90 font-medium transition-all border border-transparent hover:bg-primary/10 hover:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:border-primary/20 data-[active=true]:backdrop-blur-sm data-[active=true]:shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.4)]"
                  >
                    <NavLink to="/admin">
                      <Shield className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-[14px]">Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

