'use client';

import { Bookmark, Boxes, Flame, Home, KeyRound, LineChart, Settings, Sparkles } from 'lucide-react';
import type { TranslationCopy } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const nav = [
  { id: 'home', labelKey: 'home', icon: Home },
  { id: 'trending', labelKey: 'trendingFeed', icon: Flame },
  { id: 'keywords', labelKey: 'keywords', icon: KeyRound },
  { id: 'saved', labelKey: 'savedPosts', icon: Bookmark },
  { id: 'assets', label: 'Kho clip', icon: Boxes },
  { id: 'uploads', labelKey: 'results', icon: LineChart },
  { id: 'settings', labelKey: 'settings', icon: Settings }
] as const;

export function Sidebar({ active, onChange, copy }: { active: string; onChange: (id: string) => void; copy: TranslationCopy }) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-[#0c0f13] px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-md bg-accent text-slate-950">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-text">{copy.appName}</div>
          <div className="text-xs text-muted">{copy.appSubtitle}</div>
        </div>
      </div>

      <nav className="space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition',
                active === item.id ? 'bg-panelSoft text-text shadow-glow' : 'text-muted hover:bg-panelSoft hover:text-text'
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{'label' in item ? item.label : copy[item.labelKey]}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
