import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Languages } from 'lucide-react';

const MODELS = [
  'google/gemini-3-flash-preview',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro',
  'openai/gpt-5-mini',
];

const AdminTranslationSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { count: c }] = await Promise.all([
        supabase.from('app_settings' as any).select('key, value').in('key', ['translation_enabled', 'translation_model']),
        supabase.from('message_translations' as any).select('id', { count: 'exact', head: true }),
      ]);
      const map = new Map((settings ?? []).map((r: any) => [r.key, r.value]));
      setEnabled(map.get('translation_enabled') !== false);
      const m = map.get('translation_model');
      if (typeof m === 'string') setModel(m);
      setCount(c ?? 0);
      setLoading(false);
    })();
  }, []);

  const save = async (key: string, value: any) => {
    const { error } = await supabase.from('app_settings' as any).upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success('Saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Languages className="h-4 w-4" /> Translation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Auto translation enabled</Label>
          <Switch checked={enabled} disabled={loading} onCheckedChange={(v) => { setEnabled(v); save('translation_enabled', v); }} />
        </div>
        <div>
          <Label className="text-xs">Model</Label>
          <Select value={model} onValueChange={(v) => { setModel(v); save('translation_model', v); }} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Cached translations: <span className="font-medium text-foreground">{count}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminTranslationSettings;
