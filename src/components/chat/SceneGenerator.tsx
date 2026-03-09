import { useMemo, useState } from 'react';
import { WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
}

const LIGHT_TYPES: LightSceneType[] = ['friendly', 'romantic', 'cute'];
const DARK_TYPES: DarkSceneType[] = ['intimate', 'hot', 'intense'];

const SceneGenerator = ({ mode, chatId, otherUserId, disabled = false, onSend }: SceneGeneratorProps) => {
  const availableTypes = useMemo(() => (mode === 'light' ? LIGHT_TYPES : DARK_TYPES), [mode]);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sceneType, setSceneType] = useState<SceneType>(mode === 'light' ? 'friendly' : 'intimate');
  const [generatedScene, setGeneratedScene] = useState('');
  const [loading, setLoading] = useState(false);

  const canGenerate = prompt.trim().length >= 3 && !loading;
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
        },
      });

      if (error) {
        const msg = error.message || 'Failed to generate scene';
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
    await onSend(`📖 Scene\n\n${generatedScene.trim()}`);
    setGeneratedScene('');
    setPrompt('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <p className="text-sm font-medium text-foreground">Generate scene</p>
          <Textarea
            placeholder="Give a short prompt..."
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
          <Button type="button" variant="secondary" onClick={handleGenerate} disabled={!canGenerate}>
            {loading ? 'Generating...' : generatedScene ? 'Regenerate' : 'Generate'}
          </Button>
          <Button type="button" onClick={handleSendScene} disabled={!canSend}>
            Send Scene
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SceneGenerator;
