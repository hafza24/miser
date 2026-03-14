import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Users, MessageSquareWarning, Gauge, MessagesSquare, ArrowLeft, Ticket, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/admin', icon: Gauge, label: 'Overview' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/moderation', icon: MessageSquareWarning, label: 'Moderation' },
    { path: '/admin/chats', icon: MessagesSquare, label: 'Chats' },
    { path: '/admin/tickets', icon: Ticket, label: 'Tickets' },
    { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-lg font-bold text-foreground">Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto flex gap-1 px-4 py-2 overflow-x-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
