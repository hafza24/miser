import { useMemo, useState, useEffect, useCallback } from 'react';
import { WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Mode = 'light' | 'dark';
type LightSceneType = 'friendly' | 'romantic' | 'cute';
type DarkSceneType = 'intimate' | 'hot' | 'intense';
type SceneType = LightSceneType | DarkSceneType;

interface SceneGeneratorProps {
  mode: Mode;
  chatId: string;
  otherUserId: string;
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
  /** When set, opens as continuation mode with this pre-filled prompt suggestion */
  continuationTrigger?: number;
}

const LIGHT_TYPES: LightSceneType[] = ['friendly', 'romantic', 'cute'];
const DARK_TYPES: DarkSceneType[] = ['intimate', 'hot', 'intense'];

const SceneGenerator = ({ mode, chatId, otherUserId, disabled = false, onSend, continuationTrigger }: SceneGeneratorProps) => {
  const { user } = useAuth();
  const availableTypes = useMemo(() => (mode === 'light' ? LIGHT_TYPES : DARK_TYPES), [mode]);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sceneType, setSceneType] = useState<SceneType>(mode === 'light' ? 'friendly' : 'intimate');
  const [generatedScene, setGeneratedScene] = useState('');
  const [loading, setLoading] = useState(false);
  const [isContinuation, setIsContinuation] = useState(false);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);

  const loadDailyUsage = useCallback(async () => {
    if (!user?.id) return;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [{ count }, { data: profile }] = await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .like('content', '📖 Scene%')
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('profiles')
        .select('daily_scene_limit')
        .eq('user_id', user.id)
        .single(),
    ]);
    setDailyUsed(count ?? 0);
    setDailyLimit((profile as any)?.daily_scene_limit ?? 10);
  }, [user?.id]);

  useEffect(() => {
    loadDailyUsage();
  }, [loadDailyUsage]);

  // When continuationTrigger changes (from a "Continue Scene" click), open as continuation
  useEffect(() => {
    if (continuationTrigger && continuationTrigger > 0) {
      setIsContinuation(true);
      setPrompt('');
      setGeneratedScene('');
      setOpen(true);
    }
  }, [continuationTrigger]);

  const canGenerate = prompt.trim().length >= 3 && !loading && dailyUsed < dailyLimit;
  const canSend = generatedScene.trim().length > 0 && !loading;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-scene', {
        body: {
          chatId,
          otherUserId,
          prompt: prompt.trim(),
          mode,
          sceneType,
          isContinuation,
        },
      });

      if (error) {
        const msg = error.message || 'Failed to generate scene';
        if (msg.includes('Daily scene limit')) {
          toast.error('You\'ve used all 10 daily scenes. Try again tomorrow!');
          loadDailyUsage();
          return;
        }
        if (msg.includes('402')) {
          toast.error('Scene generation is temporarily unavailable due to billing limits.');
          return;
        }
        if (msg.includes('429')) {
          toast.error('Too many requests. Please wait a moment and try again.');
          return;
        }
        toast.error(msg);
        return;
      }

      if (!data?.scene) {
        toast.error('No scene was generated. Please try again.');
        return;
      }

      setGeneratedScene(data.scene);
    } catch (err) {
      toast.error('Failed to generate scene.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendScene = async () => {
    if (!canSend) return;
    const prefix = isContinuation ? '📖 Scene (continued)' : '📖 Scene';
    await onSend(`${prefix}\n\n${generatedScene.trim()}`);
    setGeneratedScene('');
    setPrompt('');
    setDailyUsed(prev => prev + 1);
    loadDailyUsage();
    setIsContinuation(false);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset continuation state when closing
      setIsContinuation(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="rounded-full flex-shrink-0"
          aria-label="Generate scene"
        >
          <WandSparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] space-y-3 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {isContinuation ? '✨ Continue the scene' : 'Generate scene'}
            </p>
            <span className={`text-xs font-medium ${dailyUsed >= dailyLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {dailyLimit - dailyUsed}/{dailyLimit} left
            </span>
          </div>
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyUsed >= dailyLimit
                    ? 'bg-destructive'
                    : dailyUsed >= dailyLimit * 0.7
                      ? 'bg-amber-500'
                      : 'bg-primary'
                }`}
                style={{ width: `${Math.min((dailyUsed / dailyLimit) * 100, 100)}%` }}
              />
            </div>
            {dailyUsed >= dailyLimit && (
              <p className="text-xs text-destructive font-medium">Daily limit reached — resets at midnight UTC</p>
            )}
          </div>
          {isContinuation && (
            <p className="text-xs text-muted-foreground">
              The AI will continue from where the last scene left off, with your character taking the lead.
            </p>
          )}
          <Textarea
            placeholder={isContinuation ? "What happens next? (your direction)..." : "Give a short prompt..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={200}
            className="min-h-[84px]"
          />
          <p className="text-xs text-muted-foreground">{prompt.length}/200</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => (
            <button key={type} type="button" onClick={() => setSceneType(type)}>
              <Badge variant={sceneType === type ? 'default' : 'outline'} className="capitalize">
                {type}
              </Badge>
            </button>
          ))}
        </div>

        {generatedScene && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground whitespace-pre-wrap">
            {generatedScene}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {isContinuation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setIsContinuation(false); setGeneratedScene(''); }}
              className="mr-auto text-xs"
            >
              New scene instead
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={handleGenerate} disabled={!canGenerate}>
            {loading ? 'Generating...' : generatedScene ? 'Regenerate' : isContinuation ? 'Continue' : 'Generate'}
          </Button>
          <Button type="button" onClick={handleSendScene} disabled={!canSend}>
            Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SceneGenerator;
