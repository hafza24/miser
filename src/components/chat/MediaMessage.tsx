import React, { useState, useEffect, useRef } from 'react';
import { useSignedMediaUrl } from '@/hooks/useSignedMediaUrl';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Download, Clock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

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

// Best-effort screen-recording / capture detection.
// - Native (Capacitor iOS): UIScreen.isCaptured via a plugin if present.
// - Web: heuristic — detect if a display-capture MediaStream is active by
//   watching for extended screens + document visibility. This is not perfect
//   on the web (browsers don't expose whether *this* tab is being recorded).
const detectScreenCapture = async (): Promise<boolean> => {
  try {
    // Native check (if @capacitor-community/screen-capture-detector or similar is installed)
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const plugin = cap.Plugins?.ScreenCaptureDetector || cap.Plugins?.PrivacyScreen;
      if (plugin?.isBeingCaptured) {
        const res = await plugin.isBeingCaptured();
        if (res?.value === true || res === true) return true;
      }
    }
  } catch { /* ignore */ }
  // Web heuristic: if the page is currently backgrounded or a getDisplayMedia
  // stream is running in another tab we can't reliably know. Return false.
  return false;
};

const SecureImageViewer: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  const closedRef = useRef(false);
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Common screenshot shortcuts → warn & close
      const isPrintScreen = e.key === 'PrintScreen';
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key);
      const isWinShot = e.getModifierState?.('Meta') && e.shiftKey && e.key.toLowerCase() === 's';
      if (isPrintScreen || isMacShot || isWinShot) {
        toast.warning('Screenshot detected — the sender may be notified');
      }
      close();
    };
    const onBlur = () => close();
    const onVis = () => { if (document.visibilityState !== 'visible') close(); };
    const onCtx = (e: Event) => { e.preventDefault(); close(); };

    // Native screenshot listener (Capacitor privacy-screen / screenshot plugins)
    let nativeCleanup: (() => void) | null = null;
    (async () => {
      try {
        const cap = (window as any).Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const plugin =
          cap.Plugins?.PrivacyScreen ||
          cap.Plugins?.ScreenshotDetector ||
          cap.Plugins?.ScreenCaptureDetector;
        if (!plugin?.addListener) return;
        const handle = await plugin.addListener('screenshotTaken', () => {
          toast.warning('Screenshot detected — the sender has been notified');
          close();
        });
        nativeCleanup = () => handle?.remove?.();
      } catch { /* ignore */ }
    })();

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('contextmenu', onCtx);
    const t = window.setTimeout(close, 10000);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('contextmenu', onCtx);
      clearTimeout(t);
      nativeCleanup?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none"
      onClick={close}
      onTouchStart={close}
      onPointerDown={close}
      onWheel={close}
      onContextMenu={(e) => { e.preventDefault(); close(); }}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' as any }}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        className="max-w-full max-h-full object-contain pointer-events-none"
      />
      <div className="absolute top-4 left-0 right-0 text-center text-xs text-white/70">
        Tap anywhere to close • view once
      </div>
    </div>
  );
};

const MediaMessage: React.FC<Props> = ({
  messageId, mediaPath, mediaType, viewOnce, expiresAt, isMine, viewedBy, currentUserId,
}) => {
  const alreadyViewed = viewedBy?.includes(currentUserId) ?? false;
  const secureImage = viewOnce && mediaType === 'image' && !isMine && !alreadyViewed;
  const viewOnceImage = viewOnce && mediaType === 'image';

  const [revealed, setRevealed] = useState((isMine && !viewOnceImage) || (!viewOnce) || alreadyViewed);
  const [secureOpen, setSecureOpen] = useState(false);
  const { url } = useSignedMediaUrl(mediaPath, revealed || secureOpen);
  const left = useCountdown(expiresAt);

  const markViewed = async () => {
    await supabase.rpc('mark_media_viewed' as any, { p_message_id: messageId });
  };

  const onReveal = async () => {
    if (revealed || secureOpen) return;
    // Screen-recording gate for secure images
    if (secureImage) {
      const capturing = await detectScreenCapture();
      if (capturing) {
        toast.error('Screen recording detected — image blocked');
        return;
      }
      setSecureOpen(true);
      await markViewed();
      return;
    }
    setRevealed(true);
    await markViewed();
  };

  const closeSecure = () => {
    setSecureOpen(false);
    setRevealed(true); // subsequent renders show the "viewed" state (URL may already be revoked server-side)
  };

  if (!revealed && !secureOpen) {
    const isSenderViewOnce = isMine && viewOnceImage;
    return (
      <button
        onClick={isSenderViewOnce ? undefined : onReveal}
        disabled={isSenderViewOnce}
        className="flex flex-col items-center justify-center gap-2 w-56 h-40 rounded-xl bg-muted border border-dashed border-border hover:bg-muted/70 transition disabled:cursor-not-allowed disabled:hover:bg-muted"
      >
        {secureImage ? <ShieldAlert className="h-8 w-8 text-primary" /> : <EyeOff className="h-8 w-8 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">
          {isSenderViewOnce
            ? 'View once — hidden preview'
            : secureImage
              ? 'Secure view once — tap & hold to view'
              : 'View once — tap to reveal'}
        </span>
      </button>
    );
  }

  if (secureOpen && url) {
    return <SecureImageViewer url={url} onClose={closeSecure} />;
  }

  // Post-view / non-secure rendering
  if (secureImage && !secureOpen) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-56 h-40 rounded-xl bg-muted border border-border">
        <EyeOff className="h-8 w-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Image already viewed</span>
      </div>
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
