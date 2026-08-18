import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
