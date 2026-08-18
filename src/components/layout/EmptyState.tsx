import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  } | React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        {Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : '✨'}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
        {description}
      </p>
      {action && (
        <div className="mt-6">
          {React.isValidElement(action) ? (
            action
          ) : (
            <Button onClick={(action as any).onClick} className="rounded-full px-6">
              {(action as any).label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
