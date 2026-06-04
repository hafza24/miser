import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSignedMediaUrl = (path: string | null, enabled = true) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path || !enabled) { setUrl(null); return; }
    let cancelled = false;
    const fetchUrl = async () => {
      setLoading(true);
      const { data } = await supabase.storage.from('chat-media').createSignedUrl(path, 60 * 5);
      if (!cancelled) {
        setUrl(data?.signedUrl ?? null);
        setLoading(false);
      }
    };
    fetchUrl();
    return () => { cancelled = true; };
  }, [path, enabled]);

  return { url, loading };
};
