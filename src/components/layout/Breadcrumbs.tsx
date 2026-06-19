import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  browse: 'Browse',
  groups: 'Groups',
  new: 'Create',
  profile: 'Profile',
  settings: 'Settings',
  subscription: 'Premium',
  chat: 'Chat',
  admin: 'Admin',
  users: 'Users',
  moderation: 'Moderation',
  chats: 'Chats',
  tickets: 'Tickets',
  subscriptions: 'Subscriptions',
  reports: 'Reports',
  pages: 'Pages',
  'payment-info': 'Payment Info',
};

const labelFor = (seg: string) => LABELS[seg] || seg.replace(/-/g, ' ');

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = labelFor(seg);
        return (
          <div key={href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
            {isLast ? (
              <span className="capitalize text-foreground font-medium truncate">{label}</span>
            ) : (
              <Link to={href} className="capitalize hover:text-foreground truncate">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
