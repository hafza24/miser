import { NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Search, UsersRound, User, Settings, Crown, Shield, LayoutDashboard } from 'lucide-react';
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
  { path: '/dashboard', icon: MessageCircle, label: 'Chats', badge: 'unread' as const },
  { path: '/browse', icon: Search, label: 'Browse' },
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

  const renderItem = (item: typeof mainItems[number]) => (
    <SidebarMenuItem key={item.label}>
      <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
        <NavLink to={item.path} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1">{item.label}</span>}
          {!collapsed && item.badge === 'unread' && totalUnread > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-2xl">{profile?.emoji_avatar || '💫'}</span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-heading text-base font-bold leading-none">Fur&amp;Fir</div>
              <div className="text-xs text-muted-foreground truncate">{profile?.alias}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{accountItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/admin')} tooltip="Admin Panel">
                    <NavLink to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0 text-primary" />
                      {!collapsed && <span>Admin Panel</span>}
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
