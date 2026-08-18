import React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function SectionCard({ title, description, children, className, headerActions }: SectionCardProps) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)}>
      {(title || description || headerActions) && (
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-foreground font-heading">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
