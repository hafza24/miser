import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, LogOut, Trash2, Pencil, Crown, Shield } from 'lucide-react';
import InviteUserDialog from './InviteUserDialog';

interface Member { user_id: string; role: string; alias: string; emoji_avatar: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  currentUserId: string;
  onLeft: () => void;
}

const GroupInfoSheet: React.FC<Props> = ({ open, onOpenChange, chatId, currentUserId, onLeft }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const myRole = members.find(m => m.user_id === currentUserId)?.role ?? 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  const load = async () => {
    const { data: chat } = await supabase.from('chats').select('name').eq('id', chatId).single();
    setName((chat as any)?.name ?? '');
    const { data: parts } = await supabase
      .from('chat_participants')
      .select('user_id, role')
      .eq('chat_id', chatId)
      .is('removed_at' as any, null);
    const ids = (parts ?? []).map((p: any) => p.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.rpc('get_public_profile_by_ids', { user_ids: ids });
      const lookup = new Map<string, any>((profs ?? []).map((p: any) => [p.user_id, p]));
      setMembers((parts as any).map((p: any) => ({
        user_id: p.user_id,
        role: p.role ?? 'member',
        alias: lookup.get(p.user_id)?.alias || 'Anonymous',
        emoji_avatar: lookup.get(p.user_id)?.emoji_avatar || '💫',
      })));
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    const channel = supabase
      .channel(`group-info-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants', filter: `chat_id=eq.${chatId}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chatId]);

  const saveName = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('update_group_meta' as any, { p_chat_id: chatId, p_name: name, p_image_url: null });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Group name updated'); setEditing(false); }
  };

  const leave = async () => {
    const { error } = await supabase.rpc('leave_chat' as any, { p_chat_id: chatId });
    if (error) toast.error(error.message);
    else { toast.success('You left the group'); onLeft(); }
  };

  const removeMember = async (uid: string) => {
    const { error } = await supabase.rpc('remove_chat_member' as any, { p_chat_id: chatId, p_user_id: uid });
    if (error) toast.error(error.message);
    else toast.success('Removed');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Group info</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            {editing ? (
              <div className="flex gap-2 mt-1">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                <Button size="sm" onClick={saveName} disabled={saving}>Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium flex-1">{name || 'Group chat'}</span>
                {canManage && (
                  <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Members ({members.length})</h3>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Invite
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                  <span className="text-xl">{m.emoji_avatar}</span>
                  <span className="flex-1 text-sm truncate">{m.alias}{m.user_id === currentUserId && ' (you)'}</span>
                  {m.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  {m.role === 'admin' && <Shield className="h-3.5 w-3.5 text-primary" />}
                  {canManage && m.user_id !== currentUserId && m.role !== 'owner' && (
                    <Button size="icon" variant="ghost" onClick={() => removeMember(m.user_id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button variant="destructive" className="w-full" onClick={leave}>
            <LogOut className="h-4 w-4 mr-2" /> Leave group
          </Button>
        </div>

        <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} chatId={chatId} />
      </SheetContent>
    </Sheet>
  );
};

export default GroupInfoSheet;
