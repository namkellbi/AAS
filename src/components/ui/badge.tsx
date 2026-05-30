import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-md border border-border bg-panelSoft px-2 text-xs font-medium text-muted', className)}>
      {children}
    </span>
  );
}
