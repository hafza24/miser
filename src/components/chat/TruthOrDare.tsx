import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const TRUTHS = [
  "What's your biggest secret?",
  "What's the most embarrassing thing you've done?",
  "Have you ever lied to get out of trouble?",
  "What's your guilty pleasure?",
  "What's your biggest fear?",
  "Who was your first crush?",
  "What's the worst date you've been on?",
  "What's something you've never told anyone?",
  "What's your most unpopular opinion?",
  "Have you ever stalked someone on social media?",
  "What's the last lie you told?",
  "What's your most embarrassing memory?",
  "What's the weirdest dream you've had?",
  "What's something you pretend to hate but secretly love?",
  "If you could change one thing about yourself, what would it be?",
  "What's the most childish thing you still do?",
  "Have you ever had a crush on a friend's partner?",
  "What's the most awkward conversation you've had?",
  "What's your biggest regret?",
  "What's the meanest thing you've ever said to someone?",
];

const DARES = [
  "Send the last photo in your gallery",
  "Type with your eyes closed for the next 3 messages",
  "Use only emojis for the next 5 messages",
  "Reveal your screen time for today",
  "Send a voice message singing your favorite song",
  "Change your profile emoji to something silly",
  "Tell me a joke and it has to be funny",
  "Describe yourself in 3 emojis",
  "Send a selfie right now (if comfortable)",
  "Speak in third person for the next 5 messages",
  "Make up a short poem about me",
  "Send me your most recent search history item",
  "Type 'I am awesome' in 3 different languages",
  "Give me the most honest compliment you can think of",
  "End every sentence with 'meow' for the next 3 messages",
  "Tell me your cringiest pick-up line",
  "Reveal your most played song",
  "Pretend to be a news anchor for 2 messages",
  "Send me 5 random emojis and explain what they mean",
  "Type everything in CAPS for the next 5 messages",
];

interface TruthOrDareProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const TruthOrDare: React.FC<TruthOrDareProps> = ({ onSend, disabled }) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ type: 'truth' | 'dare'; text: string } | null>(null);

  const handleChoice = (type: 'truth' | 'dare') => {
    const list = type === 'truth' ? TRUTHS : DARES;
    const randomIndex = Math.floor(Math.random() * list.length);
    setResult({ type, text: list[randomIndex] });
  };

  const handleSend = () => {
    if (result) {
      const emoji = result.type === 'truth' ? '🤔' : '🎯';
      onSend(`${emoji} ${result.type.toUpperCase()}: ${result.text}`);
      setResult(null);
      setOpen(false);
    }
  };

  const handleRandomize = () => {
    if (result) {
      handleChoice(result.type);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="rounded-full flex-shrink-0"
          title="Truth or Dare"
        >
          <Dices className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start" side="top">
        <div className="space-y-3">
          <h4 className="font-heading font-semibold text-foreground text-center">
            🎲 Truth or Dare
          </h4>
          
          {!result ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleChoice('truth')}
              >
                🤔 Truth
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleChoice('dare')}
              >
                🎯 Dare
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 text-sm text-foreground">
                <span className="font-semibold text-primary">
                  {result.type === 'truth' ? '🤔 Truth' : '🎯 Dare'}:
                </span>
                <p className="mt-1">{result.text}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleRandomize}
                >
                  🔄 Reroll
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleSend}
                >
                  📤 Send
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setResult(null)}
              >
                ← Pick again
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TruthOrDare;
