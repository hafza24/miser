import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MoodRoom {
  id: string;
  mood_key: string;
  name: string;
  description: string | null;
  emoji: string;
  mode: 'light' | 'dark';
  sort_order: number;
  is_active: boolean;
}

const empty = {
  id: '',
  mood_key: '',
  name: '',
  description: '',
  emoji: '✨',
  mode: 'light' as 'light' | 'dark',
  sort_order: 1,
  is_active: true,
};

export default function AdminMoodRooms() {
  const [rooms, setRooms] = useState<MoodRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const editing = !!form.id;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mood_rooms')
      .select('*')
      .order('mode', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) toast.error(error.message);
    else setRooms((data as MoodRoom[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: MoodRoom) => {
    setForm({
      id: r.id,
      mood_key: r.mood_key,
      name: r.name,
      description: r.description || '',
      emoji: r.emoji,
      mode: r.mode,
      sort_order: r.sort_order,
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.mood_key.trim() || !form.name.trim() || !form.emoji.trim()) {
      toast.error('Key, name, and emoji are required');
      return;
    }
    setSaving(true);
    const payload = {
      mood_key: form.mood_key.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji.trim(),
      mode: form.mode,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('mood_rooms').update(payload).eq('id', form.id)
      : await supabase.from('mood_rooms').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Room updated' : 'Room created');
    setOpen(false);
    load();
  };

  const remove = async (r: MoodRoom) => {
    if (!confirm(`Delete "${r.name}"? This will also clear its rotating chat link.`)) return;
    const { error } = await supabase.from('mood_rooms').delete().eq('id', r.id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  };

  const toggleActive = async (r: MoodRoom) => {
    const { error } = await supabase.from('mood_rooms').update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">Mood Rooms</h2>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New room</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">All rooms ({rooms.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mood rooms yet.</p>
            ) : rooms.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-border flex items-center gap-3">
                <div className="text-3xl">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant="outline" className="text-[10px]">{r.mode}</Badge>
                    <Badge variant="secondary" className="text-[10px]">#{r.sort_order}</Badge>
                    <code className="text-[10px] text-muted-foreground">{r.mood_key}</code>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                  <Button size="icon" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="destructive" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit mood room' : 'New mood room'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as 'light' | 'dark' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Key (unique per mode)</Label>
              <Input value={form.mood_key} onChange={(e) => setForm({ ...form, mood_key: e.target.value })} placeholder="e.g. date, hotnight" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
