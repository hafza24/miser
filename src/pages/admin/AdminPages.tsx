import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Save, X } from 'lucide-react';

interface SitePage {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

const AdminPages = () => {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPages = async () => {
    const { data } = await supabase.from('site_pages').select('*').order('created_at');
    if (data) setPages(data as SitePage[]);
  };

  useEffect(() => { fetchPages(); }, []);

  const startEdit = (page: SitePage) => {
    setEditing(page.id);
    setEditTitle(page.title);
    setEditContent(page.content);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditTitle('');
    setEditContent('');
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('site_pages')
      .update({ title: editTitle, content: editContent, updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save page', variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Page updated successfully' });
      cancelEdit();
      fetchPages();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-foreground">Site Pages</h2>
        <p className="text-sm text-muted-foreground">Edit content using Markdown syntax. Changes are live immediately.</p>

        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="bg-card rounded-xl border border-border p-4">
              {editing === page.id ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Page title"
                    className="font-semibold"
                  />
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Page content (Markdown)"
                    rows={16}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(page.id)} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-semibold text-foreground">{page.title}</h3>
                    <p className="text-xs text-muted-foreground">/{page.slug} • Updated {new Date(page.updated_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(page)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPages;
