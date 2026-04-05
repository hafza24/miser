import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

interface PaymentInfoRow {
  id: string;
  method_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
  sort_order: number;
}

const AdminPaymentInfo = () => {
  const [items, setItems] = useState<PaymentInfoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ method_name: '', account_number: '', account_holder: '' });
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ method_name: '', account_number: '', account_holder: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('payment_info').select('*').order('sort_order', { ascending: true });
    if (data) setItems(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (item: PaymentInfoRow) => {
    setEditingId(item.id);
    setEditForm({ method_name: item.method_name, account_number: item.account_number, account_holder: item.account_holder });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.method_name.trim() || !editForm.account_number.trim()) return;
    const { error } = await supabase.from('payment_info').update(editForm as any).eq('id', editingId);
    if (error) toast.error('Failed to update');
    else { toast.success('Updated!'); setEditingId(null); load(); }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from('payment_info').update({ is_active: !current } as any).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('payment_info').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else { toast.success('Deleted'); load(); }
  };

  const handleAdd = async () => {
    if (!newForm.method_name.trim() || !newForm.account_number.trim() || !newForm.account_holder.trim()) {
      toast.error('Fill all fields'); return;
    }
    const { error } = await supabase.from('payment_info').insert({
      method_name: newForm.method_name.trim(),
      account_number: newForm.account_number.trim(),
      account_holder: newForm.account_holder.trim(),
      sort_order: items.length + 1,
    } as any);
    if (error) toast.error('Failed to add');
    else { toast.success('Added!'); setAdding(false); setNewForm({ method_name: '', account_number: '', account_holder: '' }); load(); }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Payment Info</h2>
          <Button size="sm" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Method
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Manage payment methods shown to users on the subscription page.</p>

        {adding && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Method Name</Label><Input value={newForm.method_name} onChange={e => setNewForm(p => ({ ...p, method_name: e.target.value }))} placeholder="JazzCash" /></div>
                <div><Label>Account Number</Label><Input value={newForm.account_number} onChange={e => setNewForm(p => ({ ...p, account_number: e.target.value }))} placeholder="03..." /></div>
                <div><Label>Account Holder</Label><Input value={newForm.account_holder} onChange={e => setNewForm(p => ({ ...p, account_holder: e.target.value }))} placeholder="Name" /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="gap-1"><Save className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? <p className="text-muted-foreground">Loading...</p> : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No payment methods configured</p>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label>Method</Label><Input value={editForm.method_name} onChange={e => setEditForm(p => ({ ...p, method_name: e.target.value }))} /></div>
                        <div><Label>Account</Label><Input value={editForm.account_number} onChange={e => setEditForm(p => ({ ...p, account_number: e.target.value }))} /></div>
                        <div><Label>Holder</Label><Input value={editForm.account_holder} onChange={e => setEditForm(p => ({ ...p, account_holder: e.target.value }))} /></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} className="gap-1"><Save className="h-3.5 w-3.5" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.method_name}</p>
                        <p className="text-sm text-muted-foreground">{item.account_number} · {item.account_holder}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={item.is_active} onCheckedChange={() => handleToggleActive(item.id, item.is_active)} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentInfo;
