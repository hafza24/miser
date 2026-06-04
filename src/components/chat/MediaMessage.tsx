import React, { useState, useEffect } from 'react';
import { useSignedMediaUrl } from '@/hooks/useSignedMediaUrl';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Download, Clock } from 'lucide-react';

interface Props {
  messageId: string;
  mediaPath: string;
  mediaType: string;
  viewOnce: boolean;
  expiresAt: string | null;
  isMine: boolean;
  viewedBy: string[];
  currentUserId: string;
}

const useCountdown = (expiresAt: string | null) => {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) { setLeft(null); return; }
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
};

const formatLeft = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const MediaMessage: React.FC<Props> = ({
  messageId, mediaPath, mediaType, viewOnce, expiresAt, isMine, viewedBy, currentUserId,
}) => {
  const alreadyViewed = viewedBy?.includes(currentUserId) ?? false;
  const [revealed, setRevealed] = useState(isMine || !viewOnce || alreadyViewed);
  const { url } = useSignedMediaUrl(mediaPath, revealed);
  const left = useCountdown(expiresAt);

  const onReveal = async () => {
    if (revealed) return;
    setRevealed(true);
    await supabase.rpc('mark_media_viewed' as any, { p_message_id: messageId });
  };

  if (!revealed) {
    return (
      <button
        onClick={onReveal}
        className="flex flex-col items-center justify-center gap-2 w-56 h-40 rounded-xl bg-muted border border-dashed border-border hover:bg-muted/70 transition"
      >
        <EyeOff className="h-8 w-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">View once — tap to reveal</span>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      {url ? (
        mediaType === 'image' ? (
          <img src={url} alt="" className="max-w-[240px] max-h-[320px] rounded-xl object-cover" />
        ) : mediaType === 'video' ? (
          <video src={url} controls className="max-w-[280px] max-h-[320px] rounded-xl" />
        ) : mediaType === 'audio' ? (
          <audio src={url} controls className="max-w-[240px]" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm underline">
            <Download className="h-4 w-4" /> Download file
          </a>
        )
      ) : (
        <div className="w-48 h-32 rounded-xl bg-muted animate-pulse" />
      )}
      <div className="flex items-center gap-2 text-[10px] opacity-70">
        {viewOnce && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />view once</span>}
        {left !== null && left > 0 && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatLeft(left)} left</span>
        )}
      </div>
    </div>
  );
};

export default MediaMessage;
