import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Languages } from 'lucide-react';

interface TranslatedMessageProps {
  messageId: string;
  content: string;
  primaryLanguage: string;
  secondaryLanguage?: string | null;
  autoTranslate: boolean;
  isMine: boolean;
  renderContent?: (text: string) => React.ReactNode;
}

type State = {
  status: 'idle' | 'loading' | 'done' | 'skipped' | 'error';
  translated?: string;
  detected?: string;
  error?: string;
};

const cache = new Map<string, State>(); // key = `${messageId}:${target}`

const TranslatedMessage: React.FC<TranslatedMessageProps> = ({
  messageId,
  content,
  primaryLanguage,
  secondaryLanguage,
  autoTranslate,
  isMine,
}) => {
  const target = primaryLanguage || 'en';
  const cacheKey = `${messageId}:${target}`;
  const [state, setState] = useState<State>(() => cache.get(cacheKey) ?? { status: 'idle' });
  const lastTapRef = useRef(0);

  const update = useCallback((s: State) => {
    cache.set(cacheKey, s);
    setState(s);
  }, [cacheKey]);

  const fetchTranslation = useCallback(async () => {
    if (state.status === 'loading' || state.status === 'done') return;
    update({ status: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: { message_id: messageId, target_language: target },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const detected = (data as any).detected_language as string | undefined;
      const translated = (data as any).translated_text as string;
      const wasAlready = (data as any).was_already_target;
      // If detected matches primary or secondary, skip showing translation
      if (
        wasAlready ||
        detected === primaryLanguage ||
        (secondaryLanguage && detected === secondaryLanguage)
      ) {
        update({ status: 'skipped', detected });
        return;
      }
      update({ status: 'done', translated, detected });
    } catch (e: any) {
      update({ status: 'error', error: e?.message ?? 'Translation unavailable' });
    }
  }, [messageId, target, primaryLanguage, secondaryLanguage, state.status, update]);

  // Auto-translate on mount if enabled and not mine
  useEffect(() => {
    if (!isMine && autoTranslate && state.status === 'idle') {
      fetchTranslation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Double-tap / double-click for on-demand
  const onTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (state.status !== 'done' && state.status !== 'loading') {
        fetchTranslation();
      }
    }
    lastTapRef.current = now;
  }, [state.status, fetchTranslation]);

  return (
    <div onClick={onTap} onDoubleClick={fetchTranslation}>
      <div>{content}</div>
      {!isMine && state.status === 'loading' && (
        <div className="mt-1 flex items-center gap-1 text-[11px] opacity-60 italic">
          <Loader2 className="h-3 w-3 animate-spin" /> Translating…
        </div>
      )}
      {!isMine && state.status === 'done' && state.translated && (
        <div className="mt-1 pl-2 border-l-2 border-current/30 text-[12px] opacity-70 italic leading-snug animate-fade-in">
          {state.translated}
        </div>
      )}
      {!isMine && state.status === 'error' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fetchTranslation(); }}
          className="mt-1 flex items-center gap-1 text-[11px] opacity-70 italic hover:opacity-100"
        >
          <RefreshCw className="h-3 w-3" /> Translation unavailable — Retry
        </button>
      )}
      {!isMine && state.status === 'idle' && (
        <div className="mt-0.5 text-[10px] opacity-40 italic select-none flex items-center gap-1">
          <Languages className="h-2.5 w-2.5" /> Double-tap to translate
        </div>
      )}
    </div>
  );
};

export default TranslatedMessage;
