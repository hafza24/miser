import { Check, CheckCheck } from 'lucide-react';

interface SeenIndicatorProps {
  isSeen: boolean;
}

const SeenIndicator = ({ isSeen }: SeenIndicatorProps) => (
  <span className="inline-flex items-center ml-1">
    {isSeen ? (
      <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
    ) : (
      <Check className="h-3 w-3 text-primary-foreground/50" />
    )}
  </span>
);

export default SeenIndicator;
