import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-[#0f1217] px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20',
        className
      )}
      {...props}
    />
  );
});
