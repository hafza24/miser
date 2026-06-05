import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Clock, CheckCheck, MessageSquare, CreditCard, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const NotificationDropdown = () => {
  const { notifications, unreadNotifCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: typeof notifications[0]) => {
    markRead(n.id);
    if (n.type === 'group_invite') { navigate('/dashboard'); return; }
    if (n.meta?.chatId) navigate(`/chat/${n.meta.chatId}`);
    else if (n.type === 'chat_request') navigate('/dashboard');
    else if (n.type.startsWith('subscription') || n.type === 'payment_pending') navigate('/subscription');
  };

  const iconFor = (type: typeof notifications[0]['type']) => {
    if (type === 'chat_request') return <MessageCircle className="h-4 w-4 text-primary" />;
    if (type === 'group_invite') return <UserPlus className="h-4 w-4 text-primary" />;
    if (type === 'new_message') return <MessageSquare className="h-4 w-4 text-primary" />;
    if (type === 'expiry_alert') return <Clock className="h-4 w-4 text-destructive" />;
    return <CreditCard className="h-4 w-4 text-primary" />;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative">
          <Bell className="h-5 w-5" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-sm text-foreground">Notifications</h3>
          {unreadNotifCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3 items-start ${
                    !n.read ? 'bg-accent/20' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
