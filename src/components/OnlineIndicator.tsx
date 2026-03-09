import React from 'react';
import { cn } from '@/lib/utils';
import { formatLastSeen } from '@/lib/timeUtils';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  lastSeenAt?: string | null;
  className?: string;
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

const OnlineIndicator = ({ isOnline, size = 'md', showLabel = false, lastSeenAt, className }: OnlineIndicatorProps) => {
  const displayText = isOnline ? 'Online' : (lastSeenAt ? `Last seen ${formatLastSeen(lastSeenAt)}` : 'Offline');
  
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          sizeClasses[size],
          isOnline 
            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
            : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'
        )}
      />
      {showLabel && (
        <span className={cn(
          'text-xs font-medium',
          isOnline ? 'text-green-600' : 'text-muted-foreground'
        )}>
          {displayText}
        </span>
      )}
    </div>
  );
};

export default OnlineIndicator;
