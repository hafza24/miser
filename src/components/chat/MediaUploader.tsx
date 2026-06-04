import React, { useRef, useState } from 'react';
import { Paperclip, X, Eye, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  chatId: string;
  senderId: string;
  disabled?: boolean;
}

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'No expiry' },
  { value: '1h', label: 'Expires in 1 hour' },
  { value: '24h', label: 'Expires in 24 hours' },
  { value: '7d', label: 'Expires in 7 days' },
];

const detectType = (file: File): 'image' | 'video' | 'audio' | 'file' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
};

const MediaUploader: React.FC<Props> = ({ chatId, senderId, disabled }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [expiry, setExpiry] = useState('never');
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error('File too large (max 25MB)'); return; }
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    setOpen(true);
  };

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setViewOnce(false);
    setExpiry('never');
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const key = `${chatId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(key, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;

      let expires_at: string | null = null;
      if (expiry === '1h') expires_at = new Date(Date.now() + 3600_000).toISOString();
      else if (expiry === '24h') expires_at = new Date(Date.now() + 86400_000).toISOString();
      else if (expiry === '7d') expires_at = new Date(Date.now() + 7 * 86400_000).toISOString();

      const { error: insErr } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: senderId,
        content: '',
        media_type: detectType(file),
        media_path: key,
        media_size: file.size,
        view_once: viewOnce,
        expires_at,
      } as any);
      if (insErr) {
        await supabase.storage.from('chat-media').remove([key]);
        throw insErr;
      }
      reset();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={onPick} />
      <Button
        type="button" variant="ghost" size="icon"
        className="rounded-full flex-shrink-0 h-8 w-8"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        aria-label="Attach media"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send media</DialogTitle>
          </DialogHeader>
          {preview ? (
            <img src={preview} alt="preview" className="max-h-64 rounded-lg object-contain mx-auto" />
          ) : (
            <p className="text-sm text-muted-foreground truncate">{file?.name}</p>
          )}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4" /> View once
              </Label>
              <Switch checked={viewOnce} onCheckedChange={setViewOnce} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 text-sm flex-1">
                <Clock className="h-4 w-4" /> Expiry
              </Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset} disabled={uploading}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSend} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaUploader;
