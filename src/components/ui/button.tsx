'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-slate-950 hover:bg-sky-300',
  secondary: 'bg-panelSoft text-text ring-1 ring-border hover:bg-[#1b2029]',
  ghost: 'text-muted hover:bg-panelSoft hover:text-text',
  danger: 'bg-danger text-white hover:bg-rose-400'
};

export function Button({ className, variant = 'secondary', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
