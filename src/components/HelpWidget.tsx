import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Send, ChevronDown, ChevronRight, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FAQ_DATA = [
  {
    category: '💬 How Chats Work',
    items: [
      { q: 'How does random matching work?', a: 'When you start a random chat, the system pairs you with another user who shares your mode preference (light or dark). Each chat lasts 24 hours unless both users agree to make it permanent.' },
      { q: 'What is the chat timer?', a: 'Every new chat has a 24-hour timer. Click the timer icon to request making the chat permanent. The other user must accept for it to become permanent.' },
      { q: 'What\'s the difference between Light and Dark mode chats?', a: 'Light mode chats are for friendly, wholesome conversations. Dark mode allows more mature, intense topics. Switching from light to dark requires the other user\'s consent, but switching from dark to light is instant.' },
      { q: 'How many chats can I start per day?', a: 'By default, you can start up to 3 new chats per day. This limit resets at midnight UTC.' },
      { q: 'What are chat requests?', a: 'You can send a chat request to specific users from the Browse page. They can accept or decline. Accepted requests create a new chat.' },
    ],
  },
  {
    category: '👤 Account & Profile',
    items: [
      { q: 'How do I change my emoji avatar?', a: 'Go to your Profile page and tap on any emoji in the avatar picker to select a new one. Don\'t forget to save!' },
      { q: 'Can I change my alias?', a: 'Your alias is randomly generated to keep things anonymous. Currently, aliases cannot be changed manually.' },
      { q: 'How do I set my gender?', a: 'Go to Profile and select your gender from the dropdown. This is optional and visible to other users when they browse profiles.' },
      { q: 'What is the character profile?', a: 'You can create a character with a title, description, personality traits, and life story. This is used by the AI scene generator to create personalized scenes.' },
    ],
  },
  {
    category: '🛡️ Safety & Moderation',
    items: [
      { q: 'How is content moderated?', a: 'Messages are automatically checked against content rules based on the chat mode. Violations result in warnings, and repeated offenses may lead to account suspension.' },
      { q: 'What happens if I get suspended?', a: 'Suspended accounts cannot start new chats or send messages. If you believe this was a mistake, contact support using the form below.' },
      { q: 'How do I report someone?', a: 'You can end a chat with a user and then contact support using the form below with details about the issue.' },
    ],
  },
  {
    category: '✨ Scene Generator',
    items: [
      { q: 'What is the AI scene generator?', a: 'It\'s a creative writing tool that generates immersive scenes between you and your chat partner, using your character profiles for personalization.' },
      { q: 'How many scenes can I generate per day?', a: 'By default, you can generate up to 10 scenes per day. This limit resets at midnight UTC.' },
      { q: 'What is "Continue Scene"?', a: 'When someone sends an AI scene, the other person can click "Continue this scene" to generate a follow-up that continues the storyline.' },
      { q: 'What scene types are available?', a: 'Light mode offers Friendly, Romantic, and Cute scenes. Dark mode offers Intimate, Hot, and Intense scenes.' },
    ],
  },
];

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

const HelpWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Contact form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const loadTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, message, status, admin_reply, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setTickets((data as Ticket[]) ?? []);
    setLoadingTickets(false);
  };

  useEffect(() => {
    if (open && tab === 'tickets') {
      loadTickets();
    }
  }, [open, tab]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`tickets-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
      }, (payload) => {
        const updated = payload.new as any;
        setTickets(prev =>
          prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)
        );
        if (updated.admin_reply) {
          toast.info('Admin replied to your support ticket!');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !message.trim()) return;

    if (subject.trim().length < 3 || subject.trim().length > 100) {
      toast.error('Subject must be 3-100 characters');
      return;
    }
    if (message.trim().length < 10 || message.trim().length > 1000) {
      toast.error('Message must be 10-1000 characters');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
    } as any);

    if (error) {
      toast.error('Failed to send message');
    } else {
      toast.success('Message sent! We\'ll get back to you soon.');
      setSubject('');
      setMessage('');
      setTab('tickets');
      loadTickets();
    }
    setSending(false);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'open': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'replied': return 'bg-primary/10 text-primary border-primary/20';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return '';
    }
  };

  return (
    <>
      {/* Floating button — always visible, below panel */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          aria-label="Help & Support"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-2 left-2 sm:left-auto sm:right-4 sm:w-[340px] z-[70] max-h-[75vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 relative">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground text-sm">Help & Support</h3>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                aria-label="Close help"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-1 mt-2">
              {(['faq', 'contact', 'tickets'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'faq' ? '📖 FAQ' : t === 'contact' ? '✉️ Contact' : '📋 My Tickets'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'faq' && (
              <div className="space-y-2">
                {FAQ_DATA.map((cat, ci) => (
                  <div key={ci}>
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === ci ? null : ci)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">{cat.category}</span>
                      {expandedCategory === ci ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {expandedCategory === ci && (
                      <div className="mt-1 space-y-1 pl-2">
                        {cat.items.map((item, ii) => {
                          const key = `${ci}-${ii}`;
                          return (
                            <div key={key}>
                              <button
                                onClick={() => setExpandedItem(expandedItem === key ? null : key)}
                                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-foreground hover:bg-accent/30 transition-colors flex items-center gap-2"
                              >
                                <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform flex-shrink-0 ${expandedItem === key ? 'rotate-90' : ''}`} />
                                {item.q}
                              </button>
                              {expandedItem === key && (
                                <p className="text-xs text-muted-foreground px-3 py-2 ml-5 bg-muted/30 rounded">
                                  {item.a}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'contact' && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Send a message to our admin team. We'll reply as soon as possible.
                </p>
                <div>
                  <Input
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={100}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">{subject.length}/100</p>
                </div>
                <div>
                  <Textarea
                    placeholder="Describe your issue or question..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={1000}
                    className="min-h-[100px] text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">{message.length}/1000</p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sending || !subject.trim() || !message.trim()}
                  size="sm"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Send Message
                </Button>
              </form>
            )}

            {tab === 'tickets' && (
              <div className="space-y-2">
                {loadingTickets ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No tickets yet</p>
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <div key={ticket.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground leading-tight">{ticket.subject}</p>
                        <Badge className={`text-[9px] px-1.5 py-0 capitalize flex-shrink-0 ${statusColor(ticket.status)}`}>
                          {ticket.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{ticket.message}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</p>
                      {ticket.admin_reply && (
                        <div className="bg-primary/5 border border-primary/10 rounded-md p-2 mt-1">
                          <p className="text-[10px] font-medium text-primary mb-0.5">Admin Reply:</p>
                          <p className="text-[11px] text-foreground">{ticket.admin_reply}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default HelpWidget;
