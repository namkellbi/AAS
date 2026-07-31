'use client';

import { ArrowRight, CheckCircle2, Circle, Clock3, ExternalLink, Link2, Settings2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { CreateFromLinkProgress, ThreadsPost } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CreateVideoHome({
  copy,
  createLinkProgress,
  createLinkUrl,
  creativeAiEnabled,
  isCreatingFromLink,
  language,
  openAiReady,
  posts,
  threadsReady,
  onCreateFromLink,
  onCreateLinkUrl,
  onNavigateSettings,
  onOpenDraft,
  onOpenLink
}: {
  copy: TranslationCopy;
  createLinkProgress: CreateFromLinkProgress | null;
  createLinkUrl: string;
  creativeAiEnabled: boolean;
  isCreatingFromLink: boolean;
  language: 'en' | 'vi';
  openAiReady: boolean;
  posts: ThreadsPost[];
  threadsReady: boolean;
  onCreateFromLink: () => void;
  onCreateLinkUrl: (url: string) => void;
  onNavigateSettings: () => void;
  onOpenDraft: (post: ThreadsPost) => void;
  onOpenLink: (post: ThreadsPost) => void;
}) {
  const vi = language === 'vi';
  const recentPosts = [...posts]
    .filter((post) => post.source === 'manual')
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
    .slice(0, 5);
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

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted" />
            <h2 className="text-sm font-semibold text-text">{vi ? 'Bài đã nhập gần đây' : 'Recent imports'}</h2>
          </div>
          {!setupReady ? (
            <Button className="h-8 px-3 text-xs" icon={<Settings2 className="size-3.5" />} onClick={onNavigateSettings}>
              {vi ? 'Mở cài đặt' : 'Open settings'}
            </Button>
          ) : null}
        </div>

        {recentPosts.length ? (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
            {recentPosts.map((post) => (
              <article key={post.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="truncate font-medium text-slate-300">@{post.authorHandle || post.author}</span>
                    <span>{formatRecentDate(post.fetchedAt, language)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-200">{post.content}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    aria-label={copy.openLink}
                    title={copy.openLink}
                    className="h-9 px-2.5"
                    icon={<ExternalLink className="size-4" />}
                    onClick={() => onOpenLink(post)}
                  />
                  <Button
                    variant="primary"
                    className="h-9"
                    icon={<ArrowRight className="size-4" />}
                    onClick={() => onOpenDraft(post)}
                  >
                    {vi ? 'Mở video' : 'Open video'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            {vi ? 'Chưa có bài nào. Dán link ở trên để bắt đầu.' : 'No imports yet. Paste a link above to begin.'}
          </div>
        )}
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

function formatRecentDate(value: string, language: 'en' | 'vi') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
