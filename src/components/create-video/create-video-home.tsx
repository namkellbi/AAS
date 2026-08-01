'use client';

import { CheckCircle2, Circle, Link2, Settings2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { CreateFromLinkProgress } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CreateVideoHome({
  copy,
  createLinkProgress,
  createLinkUrl,
  creativeAiEnabled,
  isCreatingFromLink,
  language,
  openAiReady,
  threadsReady,
  onCreateFromLink,
  onCreateLinkUrl,
  onNavigateSettings,
}: {
  copy: TranslationCopy;
  createLinkProgress: CreateFromLinkProgress | null;
  createLinkUrl: string;
  creativeAiEnabled: boolean;
  isCreatingFromLink: boolean;
  language: 'en' | 'vi';
  openAiReady: boolean;
  threadsReady: boolean;
  onCreateFromLink: () => void;
  onCreateLinkUrl: (url: string) => void;
  onNavigateSettings: () => void;
}) {
  const vi = language === 'vi';
  const setupReady = openAiReady && threadsReady;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-8">
      <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-glow">
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-accent">
                {creativeAiEnabled ? (vi ? 'AI sáng tạo đang bật' : 'Creative AI on') : (vi ? 'Chế độ nguyên bản' : 'Original mode')}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-text">{vi ? 'Dán link bài Threads' : 'Paste a Threads post link'}</h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 text-xs text-muted transition hover:text-text"
              onClick={onNavigateSettings}
            >
              <Settings2 className="size-4" />
              {vi ? 'Cấu hình' : 'Configure'}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                value={createLinkUrl}
                onChange={(event) => onCreateLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && createLinkUrl.trim() && !isCreatingFromLink) onCreateFromLink();
                }}
                className="h-12 pl-10"
                placeholder="https://www.threads.net/@.../post/..."
              />
            </div>
            <Button
              variant="primary"
              className="h-12 shrink-0 px-5"
              icon={<Video className={cn('size-4', isCreatingFromLink && 'animate-pulse')} />}
              disabled={!createLinkUrl.trim() || isCreatingFromLink}
              onClick={onCreateFromLink}
            >
              {isCreatingFromLink ? copy.createFromLinkWorking : (vi ? 'Tiếp tục' : 'Continue')}
            </Button>
          </div>

          {isCreatingFromLink && createLinkProgress ? (
            <div className="mt-4 space-y-2" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="truncate">{createLinkProgress.message}</span>
                <span>{createLinkProgress.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${createLinkProgress.percent}%` }} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          <ModeItem
            done
            label={vi ? 'Nội dung bài gốc' : 'Original post'}
            value={creativeAiEnabled ? (vi ? 'Có thể thêm AI copy' : 'AI copy may be added') : (vi ? 'Giữ nguyên từng chữ' : 'Kept verbatim')}
          />
          <ModeItem
            done
            label={vi ? 'Replies' : 'Replies'}
            value={vi ? 'Chọn trước khi render' : 'Review before render'}
          />
          <ModeItem
            done={setupReady}
            label={vi ? 'Kết nối' : 'Connections'}
            value={setupReady ? (vi ? 'Sẵn sàng' : 'Ready') : (vi ? 'Cần hoàn tất cài đặt' : 'Setup required')}
            onClick={setupReady ? undefined : onNavigateSettings}
          />
        </div>
      </section>

    </div>
  );
}

function ModeItem({ done, label, onClick, value }: { done: boolean; label: string; onClick?: () => void; value: string }) {
  const content = (
    <>
      {done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : <Circle className="size-4 shrink-0 text-amber-300" />}
      <div className="min-w-0">
        <div className="text-xs font-medium text-text">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted">{value}</div>
      </div>
    </>
  );
  return onClick ? (
    <button type="button" className="flex items-center gap-3 bg-panelSoft px-5 py-3 text-left transition hover:bg-[#1a1f29]" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 bg-panelSoft px-5 py-3">{content}</div>
  );
}
