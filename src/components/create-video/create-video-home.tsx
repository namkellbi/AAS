'use client';

import { useMemo, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Circle, FileText, FolderOpen, Link2, LoaderCircle, Settings2, Sparkles, Upload, Video, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseThreadsBatchInput } from '@/lib/batch-links';
import type { BatchCreateFromLinksItem, BatchCreateFromLinksProgress, BatchCreateFromLinksResult, GeneratedVideoItem, SpeechNormalizationState, VideoDraftRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CreateVideoHome({
  batchInput,
  batchProgress,
  batchResult,
  isCreatingBatch,
  isNormalizingBatch,
  language,
  normalizationReady,
  normalizations,
  reviewedDrafts,
  generatedVideos,
  batchRenderState,
  threadsReady,
  onBatchInput,
  onCreateBatch,
  onNavigateSettings,
  onNormalizeBatch,
  onOpenBrief,
  onOpenGenerated,
  onRenderReviewed,
  onResetBatch
}: {
  batchInput: string;
  batchProgress: Record<number, BatchCreateFromLinksProgress>;
  batchResult: BatchCreateFromLinksResult | null;
  isCreatingBatch: boolean;
  isNormalizingBatch: boolean;
  language: 'en' | 'vi';
  normalizationReady: boolean;
  normalizations: Record<string, SpeechNormalizationState>;
  reviewedDrafts: Record<string, { request: VideoDraftRequest; reviewed: boolean }>;
  generatedVideos: GeneratedVideoItem[];
  batchRenderState: { running: boolean; completed: number; total: number; currentPostId?: string; failedPostIds: string[] };
  threadsReady: boolean;
  onBatchInput: (value: string) => void;
  onCreateBatch: (urls: string[]) => void;
  onNavigateSettings: () => void;
  onNormalizeBatch: () => void;
  onOpenBrief: (item: BatchCreateFromLinksItem) => void;
  onOpenGenerated: (filePath: string) => void;
  onRenderReviewed: () => void;
  onResetBatch: () => void;
}) {
  const vi = language === 'vi';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseThreadsBatchInput(batchInput), [batchInput]);
  const displayItems = batchResult?.items ?? parsed.urls.map((url, index) => ({
    url,
    status: batchProgress[index]?.status ?? 'queued',
    progress: batchProgress[index]
  }));
  const completed = batchResult
    ? batchResult.items.length
    : Object.values(batchProgress).filter((item) => item.status !== 'fetching').length;
  const currentPercent = Math.max(0, ...Object.values(batchProgress).map((item) => item.percent));
  const readyItems = batchResult?.items.filter((item) => item.status === 'ready' && item.post) ?? [];
  const generatedByPostId = useMemo(() => {
    const videos = new Map<string, GeneratedVideoItem>();
    generatedVideos.forEach((video) => {
      if (!videos.has(video.postId)) videos.set(video.postId, video);
    });
    return videos;
  }, [generatedVideos]);
  const pendingVideoItems = readyItems.filter((item) => !generatedByPostId.has(item.post!.id));
  const reviewedPendingCount = pendingVideoItems.filter((item) => reviewedDrafts[item.post!.id]?.reviewed).length;
  const allPendingReviewed = pendingVideoItems.length > 0 && reviewedPendingCount === pendingVideoItems.length;
  const normalizedCount = readyItems.filter((item) => normalizations[item.post!.id]?.status === 'ready').length;
  const normalizationFailedCount = readyItems.filter((item) => normalizations[item.post!.id]?.status === 'failed').length;
  const flowSteps = vi
    ? ['Dán link Threads', 'Tool lọc bài & chuẩn hóa', 'Mở brief, duyệt & tạo video']
    : ['Paste Threads links', 'Filter & normalize automatically', 'Open brief, review & create'];

  async function readTextFile(file?: File) {
    if (!file) return;
    const text = (await file.text()).replace(/^\uFEFF/, '');
    onBatchInput([batchInput.trim(), text.trim()].filter(Boolean).join('\n'));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-glow">
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Threads video workspace</div>
              <h2 className="mt-2 text-lg font-semibold text-text">{vi ? 'Mỗi Threads link → một video' : 'One Threads link → one video'}</h2>
              <p className="mt-1 text-sm text-muted">{vi ? 'Dán nhiều link, mỗi link một dòng, hoặc nhập danh sách từ file TXT.' : 'Paste one link per line or import a TXT list.'}</p>
            </div>
            <button type="button" className="flex items-center gap-2 text-xs text-muted transition hover:text-text" onClick={onNavigateSettings}>
              <Settings2 className="size-4" />
              {vi ? 'Cấu hình' : 'Configure'}
            </button>
          </div>

          <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label={vi ? 'Quy trình tạo video' : 'Video creation flow'}>
            {flowSteps.map((step, index) => (
              <li key={step} className="flex items-center gap-2 rounded-md border border-border bg-panelSoft px-3 py-2 text-xs font-medium text-text">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="relative mt-4">
            <Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
            <textarea
              autoFocus
              value={batchInput}
              disabled={isCreatingBatch || batchRenderState.running}
              onChange={(event) => onBatchInput(event.target.value)}
              className="min-h-36 w-full resize-y rounded-md border border-border bg-[#0f1217] py-3 pl-10 pr-3 font-mono text-sm leading-6 text-text outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
              placeholder={'https://www.threads.com/@account/post/ABC\nhttps://www.threads.com/@account/post/DEF'}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(event) => {
                  void readTextFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
              <Button icon={<Upload className="size-4" />} disabled={isCreatingBatch || batchRenderState.running} onClick={() => fileInputRef.current?.click()}>
                {vi ? 'Nhập file .txt' : 'Import .txt'}
              </Button>
              <span className="text-emerald-300">{parsed.urls.length} link hợp lệ</span>
              {parsed.duplicateCount ? <span className="text-amber-300">{parsed.duplicateCount} trùng</span> : null}
              {parsed.invalidLines.length ? <span className="text-rose-300">{parsed.invalidLines.length} dòng sai</span> : null}
              {parsed.overflowCount ? <span className="text-rose-300">{parsed.overflowCount} vượt giới hạn</span> : null}
            </div>
            <div className="flex items-center gap-2">
              {(batchResult || Object.keys(batchProgress).length > 0) ? <Button disabled={isCreatingBatch || batchRenderState.running} onClick={onResetBatch}>{vi ? 'Batch mới' : 'New batch'}</Button> : null}
              <Button
                variant="primary"
                className="h-10 px-5"
                icon={isCreatingBatch ? <LoaderCircle className="size-4 animate-spin" /> : <Video className="size-4" />}
                disabled={!threadsReady || !parsed.urls.length || isCreatingBatch || batchRenderState.running}
                onClick={() => onCreateBatch(parsed.urls)}
              >
                {isCreatingBatch
                  ? `${vi ? 'Đang xử lý' : 'Processing'} ${completed}/${parsed.urls.length}`
                  : `${vi ? 'Bắt đầu xử lý' : 'Start processing'} ${parsed.urls.length || 0} ${vi ? 'bài' : 'posts'}`}
              </Button>
            </div>
          </div>

          {!threadsReady ? (
            <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
              Cần đăng nhập Threads trước khi chạy batch.
            </div>
          ) : null}
        </div>

      </section>

      {(isCreatingBatch || batchResult) ? (
        <section className="overflow-hidden rounded-lg border border-border bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h3 className="font-semibold text-text">Kết quả batch</h3>
              <div className="mt-1 text-xs text-muted">
                {batchResult
                  ? `${batchResult.readyCount} sẵn sàng · ${batchResult.rejectedCount} bị loại · ${batchResult.failedCount} lỗi`
                  : `${completed}/${parsed.urls.length} bài đã kiểm tra`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {batchResult?.readyCount ? (
                <Button
                  variant="primary"
                  icon={isNormalizingBatch ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  disabled={batchRenderState.running || isNormalizingBatch || (normalizationReady && normalizedCount === readyItems.length)}
                  onClick={normalizationReady ? onNormalizeBatch : onNavigateSettings}
                >
                  {!normalizationReady
                    ? 'Cấu hình chuẩn hóa'
                    : isNormalizingBatch
                      ? 'Đang chuẩn hóa ' + normalizedCount + '/' + readyItems.length
                      : normalizationFailedCount
                        ? 'Thử lại ' + normalizationFailedCount + ' bài lỗi'
                        : normalizedCount === readyItems.length
                          ? 'Đã chuẩn hóa ' + normalizedCount + ' bài'
                          : 'Chuẩn hóa ' + readyItems.length + ' bài'}
                </Button>
              ) : null}
              {batchResult?.readyCount ? (
                <Button
                  variant="primary"
                  icon={batchRenderState.running ? <LoaderCircle className="size-4 animate-spin" /> : <Video className="size-4" />}
                  disabled={batchRenderState.running || !allPendingReviewed}
                  title={!allPendingReviewed && pendingVideoItems.length ? `Còn ${pendingVideoItems.length - reviewedPendingCount} brief chưa duyệt` : undefined}
                  onClick={onRenderReviewed}
                >
                  {batchRenderState.running
                    ? `Đang tạo ${batchRenderState.completed}/${batchRenderState.total}`
                    : pendingVideoItems.length
                      ? `Tạo tất cả video đã duyệt (${pendingVideoItems.length})`
                      : `Đã tạo đủ ${readyItems.length} video`}
                </Button>
              ) : null}
              {isCreatingBatch && !isNormalizingBatch ? <div className="text-sm font-medium text-accent">{currentPercent}%</div> : null}
            </div>
          </div>
          {isCreatingBatch ? (
            <div className="h-1.5 bg-border">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${currentPercent}%` }} />
            </div>
          ) : null}
          <div className="divide-y divide-border">
            {displayItems.map((item, index) => (
              <BatchRow
                key={item.url + ':' + index}
                index={index}
                item={item}
                normalization={'post' in item && item.post ? normalizations[item.post.id] : undefined}
                reviewed={'post' in item && item.post ? Boolean(reviewedDrafts[item.post.id]?.reviewed) : false}
                generatedVideo={'post' in item && item.post ? generatedByPostId.get(item.post.id) : undefined}
                rendering={'post' in item && item.post ? batchRenderState.running && batchRenderState.currentPostId === item.post.id : false}
                batchBusy={batchRenderState.running}
                renderFailed={'post' in item && item.post ? batchRenderState.failedPostIds.includes(item.post.id) : false}
                onOpenBrief={onOpenBrief}
                onOpenGenerated={onOpenGenerated}
              />
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}
function BatchRow({ index, item, normalization, reviewed, generatedVideo, rendering, batchBusy, renderFailed, onOpenBrief, onOpenGenerated }: {
  index: number;
  item: BatchCreateFromLinksItem | { url: string; status: string; progress?: BatchCreateFromLinksProgress };
  normalization?: SpeechNormalizationState;
  reviewed: boolean;
  generatedVideo?: GeneratedVideoItem;
  rendering: boolean;
  batchBusy: boolean;
  renderFailed: boolean;
  onOpenBrief: (item: BatchCreateFromLinksItem) => void;
  onOpenGenerated: (filePath: string) => void;
}) {
  const completedItem = 'qualifiedCommentCount' in item ? item as BatchCreateFromLinksItem : null;
  const status = item.status;
  const icon = status === 'ready'
    ? <CheckCircle2 className="size-4 text-emerald-300" />
    : status === 'rejected'
      ? <AlertTriangle className="size-4 text-amber-300" />
      : status === 'failed'
        ? <XCircle className="size-4 text-rose-300" />
        : status === 'fetching'
          ? <LoaderCircle className="size-4 animate-spin text-accent" />
          : <Circle className="size-4 text-muted" />;
  const label = status === 'ready' ? 'Sẵn sàng'
    : status === 'rejected' ? 'Đã loại'
      : status === 'failed' ? 'Lỗi'
        : status === 'fetching' ? 'Đang tải comments' : 'Đang chờ';

  return (
    <div className="grid gap-3 px-5 py-3 md:grid-cols-[44px_minmax(0,1fr)_220px_160px] md:items-center">
      <div className="text-xs font-semibold text-muted">{String(index + 1).padStart(2, '0')}</div>
      <div className="min-w-0">
        <div className="truncate text-sm text-text" title={item.url}>{item.url}</div>
        <div className={cn('mt-1 text-xs', status === 'failed' ? 'text-rose-300' : status === 'rejected' ? 'text-amber-200' : 'text-muted')}>
          {completedItem?.reason
            ?? ('progress' in item ? item.progress?.message : undefined)
            ?? (completedItem ? `${completedItem.qualifiedCommentCount} comment đạt chuẩn` : 'Chờ worker khả dụng')}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-text">{icon}{label}</div>
        {normalization ? (
          <div className={cn(
            'mt-1 text-[11px]',
            normalization.status === 'ready'
              ? 'text-emerald-300'
              : normalization.status === 'failed'
                ? 'text-rose-300'
                : 'text-sky-300'
          )}>
            {normalization.status === 'ready'
              ? [
                  'Đã chuẩn hóa',
                  normalization.result?.provider === 'codex' ? 'ChatGPT' : 'OpenAI API',
                  normalization.result?.cached ? 'cache' : null
                ].filter(Boolean).join(' · ')
              : normalization.status === 'failed'
                ? 'Chuẩn hóa lỗi'
                : normalization.status === 'normalizing'
                  ? 'Đang chuẩn hóa...'
                  : 'Chờ chuẩn hóa'}
          </div>
        ) : null}
        {generatedVideo ? (
          <div className="mt-1 text-[11px] text-emerald-300">Đã tạo video</div>
        ) : rendering ? (
          <div className="mt-1 text-[11px] text-sky-300">Đang tạo video...</div>
        ) : renderFailed ? (
          <div className="mt-1 text-[11px] text-rose-300">Tạo video lỗi · có thể thử lại</div>
        ) : reviewed ? (
          <div className="mt-1 text-[11px] text-emerald-300">Đã duyệt nội dung</div>
        ) : completedItem?.status === 'ready' ? (
          <div className="mt-1 text-[11px] text-muted">Chờ duyệt nội dung</div>
        ) : null}
      </div>
      <div className="flex min-w-[160px] flex-nowrap justify-end gap-2">
        {completedItem?.status === 'ready' ? (
          <>
            {generatedVideo ? (
              <Button
                aria-label="Mở thư mục chứa video"
                title="Mở thư mục chứa video"
                className="h-8 shrink-0 px-2"
                icon={<FolderOpen className="size-3.5" />}
                onClick={() => onOpenGenerated(generatedVideo.filePath)}
              />
            ) : null}
            <Button
              variant="primary"
              className="h-8 shrink-0 whitespace-nowrap text-xs"
              icon={normalization?.status === 'normalizing' ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
              disabled={normalization?.status === 'normalizing' || normalization?.status === 'queued' || batchBusy}
              onClick={() => onOpenBrief(completedItem)}
            >
              Mở brief
            </Button>
          </>
        ) : completedItem ? (
          <span className="text-right text-[11px] text-muted">Top like: {completedItem.maxCommentLikes.toLocaleString('vi-VN')}</span>
        ) : null}
      </div>
    </div>
  );
}
