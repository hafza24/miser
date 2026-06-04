import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

interface Hit { user_id: string; alias: string; emoji_avatar: string }

const InviteUserDialog: React.FC<Props> = ({ open, onOpenChange, chatId }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const search = async () => {
    if (q.trim().length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, alias, emoji_avatar, is_suspended, profile_paused')
      .ilike('alias', `%${q.trim()}%`)
      .limit(20);
    const filtered = (data ?? []).filter((p: any) => !p.is_suspended && !p.profile_paused);
    setResults(filtered.map((p: any) => ({ user_id: p.user_id, alias: p.alias, emoji_avatar: p.emoji_avatar })));
    setSearching(false);
  };

  const invite = async (user_id: string) => {
    setInvitingId(user_id);
    const { error } = await supabase.rpc('invite_to_chat' as any, { p_chat_id: chatId, p_user_id: user_id });
    setInvitingId(null);
    if (error) toast.error(error.message);
    else toast.success('Invite sent');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite to chat</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by alias…" />
          <Button type="submit" size="icon" disabled={searching}><Search className="h-4 w-4" /></Button>
        </form>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <div key={r.user_id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <span className="text-xl">{r.emoji_avatar}</span>
              <span className="flex-1 text-sm">{r.alias}</span>
              <Button size="sm" disabled={invitingId === r.user_id} onClick={() => invite(r.user_id)}>
                <UserPlus className="h-4 w-4 mr-1" /> Invite
              </Button>
            </div>
          ))}
          {!searching && q && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No matches</p>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
