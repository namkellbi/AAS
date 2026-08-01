'use client';

import { Bookmark, Boxes, CircleCheckBig, Flame, KeyRound, LineChart, Radar, Settings, ShoppingBag, Sparkles, Video } from 'lucide-react';
import type { TranslationCopy } from '@/lib/i18n';
import type { FeatureVisibility } from '@/lib/types';
import { cn } from '@/lib/utils';

const dailyNav = [
  { id: 'home', label: 'Create video', icon: Video },
  { id: 'reviews', label: 'Review videos', icon: CircleCheckBig },
  { id: 'uploads', labelKey: 'results', icon: LineChart }
] as const;

const advancedNav = [
  { id: 'opportunities', labelKey: 'opportunityInbox', icon: Radar },
  { id: 'trending', labelKey: 'trendingFeed', icon: Flame },
  { id: 'keywords', labelKey: 'keywords', icon: KeyRound },
  { id: 'saved', labelKey: 'savedPosts', icon: Bookmark },
  { id: 'products', labelKey: 'products', icon: ShoppingBag },
  { id: 'assets', label: 'Kho clip', icon: Boxes }
] as const;

type NavItem = (typeof dailyNav)[number] | (typeof advancedNav)[number] | { id: 'settings'; labelKey: 'settings'; icon: typeof Settings };

export function Sidebar({ active, features, language, onChange, copy }: { active: string; features: FeatureVisibility; language: 'en' | 'vi'; onChange: (id: string) => void; copy: TranslationCopy }) {
  const visibleDailyNav = dailyNav;
  const visibleAdvancedNav = advancedNav.filter((item) => {
    if (item.id === 'products') return features.affiliateWorkspace;
    if (item.id === 'assets') return true;
    return features.opportunityDiscovery;
  });
  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const label = item.id === 'home'
      ? (language === 'vi' ? 'Tạo video' : 'Create video')
      : item.id === 'reviews'
        ? (language === 'vi' ? 'Duyệt video' : 'Review videos')
        : item.id === 'uploads'
          ? (language === 'vi' ? 'Hiệu suất' : 'Performance')
        : 'label' in item ? item.label : copy[item.labelKey];
    return (
      <button
        key={item.id}
        title={label}
        aria-label={label}
        onClick={() => onChange(item.id)}
        className={cn(
          'flex h-10 w-full items-center justify-center gap-3 rounded-md px-2 text-left text-sm transition lg:justify-start lg:px-3',
          active === item.id ? 'bg-panelSoft text-text shadow-glow' : 'text-muted hover:bg-panelSoft hover:text-text'
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="hidden truncate lg:block">{label}</span>
      </button>
    );
  };

  return (
    <aside className="flex h-screen w-16 shrink-0 flex-col border-r border-border bg-[#0c0f13] px-2 py-4 lg:w-64 lg:px-3">
      <div className="mb-6 flex items-center justify-center gap-3 px-1 lg:justify-start lg:px-2">
        <div className="grid size-9 place-items-center rounded-md bg-accent text-slate-950">
          <Sparkles className="size-5" />
        </div>
        <div className="hidden lg:block">
          <div className="text-sm font-semibold text-text">{copy.appName}</div>
          <div className="text-xs text-muted">{copy.appSubtitle}</div>
        </div>
      </div>

      <nav className="space-y-1">
        <div className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted lg:block">{copy.navDaily}</div>
        {visibleDailyNav.map(renderItem)}
        {visibleAdvancedNav.length ? (
          <>
            <div className="hidden px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted lg:block">{copy.navAdvanced}</div>
            {visibleAdvancedNav.map(renderItem)}
          </>
        ) : null}
      </nav>

      <div className="mt-auto">
        {renderItem({ id: 'settings', labelKey: 'settings', icon: Settings })}
      </div>
    </aside>
  );
}
