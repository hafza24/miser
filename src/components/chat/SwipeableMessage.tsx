import React, { useRef, useState } from 'react';
import { Reply } from 'lucide-react';

interface SwipeableMessageProps {
  isMe: boolean;
  disabled?: boolean;
  onReply: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}

const LONG_PRESS_MS = 500;
const SWIPE_REPLY_THRESHOLD = 60;
const SWIPE_MAX = 90;

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
  isMe,
  disabled,
  onReply,
  onLongPress,
  children,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [showReplyHint, setShowReplyHint] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const movedRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    isSwiping.current = false;
    movedRef.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (!movedRef.current) onLongPress();
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      movedRef.current = true;
      clearLongPress();
    }

    // Only horizontal swipes; direction depends on side
    if (Math.abs(dx) > Math.abs(dy)) {
      const allowed = isMe ? dx < 0 : dx > 0; // swipe inward toward center
      if (allowed) {
        isSwiping.current = true;
        const clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
        setTranslateX(clamped);
        setShowReplyHint(Math.abs(clamped) >= SWIPE_REPLY_THRESHOLD);
      }
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    if (isSwiping.current && Math.abs(translateX) >= SWIPE_REPLY_THRESHOLD) {
      onReply();
    }
    setTranslateX(0);
    setShowReplyHint(false);
    isSwiping.current = false;
  };

  return (
    <div className="relative">
      {/* Reply icon revealed during swipe */}
      <div
        className={`absolute inset-y-0 ${isMe ? 'right-0' : 'left-0'} flex items-center px-2 pointer-events-none transition-opacity ${
          Math.abs(translateX) > 10 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className={`rounded-full p-1.5 transition-colors ${
            showReplyHint ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Reply className="h-3.5 w-3.5" />
        </div>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onLongPress();
        }}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableMessage;
