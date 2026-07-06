import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getActiveMentionQuery, MentionMember } from '@/lib/mentions';

interface MentionInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (v: string) => void;
  onTyping?: () => void;
  members: MentionMember[];
  currentUserId?: string | null;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onValueChange,
  onTyping,
  members,
  currentUserId,
  onKeyDown,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const active = useMemo(() => getActiveMentionQuery(value, caret), [value, caret]);

  const suggestions = useMemo(() => {
    if (!active) return [];
    const q = active.query.toLowerCase();
    return members
      .filter(m => m.user_id !== currentUserId)
      .filter(m => (q ? m.alias.toLowerCase().startsWith(q) : true))
      .slice(0, 6);
  }, [active, members, currentUserId]);

  useEffect(() => {
    setOpen(Boolean(active) && suggestions.length > 0);
    setHighlight(0);
  }, [active, suggestions.length]);

  const insertMention = (m: MentionMember) => {
    if (!active) return;
    const before = value.slice(0, active.start);
    const after = value.slice(caret);
    const inserted = `@${m.alias} `;
    const next = before + inserted + after;
    onValueChange(next);
    const nextCaret = (before + inserted).length;
    setOpen(false);
    // restore caret after React updates value
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
        setCaret(nextCaret);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(h => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(h => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1">
      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-30"
        >
          {suggestions.map((m, i) => (
            <button
              key={m.user_id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                i === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
              }`}
            >
              <span className="text-base">{m.emoji_avatar || '💬'}</span>
              <span className="truncate">
                <span className="text-muted-foreground">@</span>
                <span className="font-medium">{m.alias}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Input
        {...rest}
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          onTyping?.();
        }}
        onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export default MentionInput;
