'use client';

/* eslint-disable @next/next/no-img-element */

import { CheckCircle2, CircleDashed, ExternalLink, FolderOpen, Play, Send, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_TIKTOK_CAPTION_LENGTH, normalizeTikTokCaption } from '@/lib/tiktokCaption';
import type { GeneratedVideoItem, ManualPublishRequest, ThreadsPost } from '@/lib/types';
import { cn } from '@/lib/utils';

type ReviewFilter = 'all' | 'pending' | 'approved';

export function VideoReviewQueue({
  language,
  posts,
  videos,
  onApprove,
  onOpenDraft,
  onOpenLink,
  onOpenVideo,
  onMarkManual,
  onPrepareUpload
}: {
  language: 'en' | 'vi';
  posts: ThreadsPost[];
  videos: GeneratedVideoItem[];
  onApprove: (filePath: string, approved: boolean) => void;
  onOpenDraft: (post: ThreadsPost) => void;
  onOpenLink: (post: ThreadsPost) => void;
  onOpenVideo: (filePath: string) => void;
  onMarkManual: (filePath: string, request: ManualPublishRequest) => Promise<void>;
  onPrepareUpload: (filePath: string, caption: string) => Promise<void>;
}) {
  const vi = language === 'vi';
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [publishTarget, setPublishTarget] = useState<GeneratedVideoItem | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [manualTarget, setManualTarget] = useState<GeneratedVideoItem | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [manualCaption, setManualCaption] = useState('');
  const [manualPublishMethod, setManualPublishMethod] = useState<'tiktok_studio' | 'mobile'>('tiktok_studio');
  const [manualUploadedAt, setManualUploadedAt] = useState(() => localDateTimeValue(new Date()));
  const rows = useMemo(() => {
    const manualPosts = [...posts]
      .filter((post) => post.source === 'manual')
      .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
    const postById = new Map(manualPosts.map((post) => [post.id, post]));
    const videoByPost = new Map<string, GeneratedVideoItem>();
    for (const video of videos) if (!videoByPost.has(video.postId)) videoByPost.set(video.postId, video);
    const combined: Array<{ post?: ThreadsPost; video?: GeneratedVideoItem }> = manualPosts.map((post) => ({ post, video: videoByPost.get(post.id) }));
    for (const video of videos) if (!postById.has(video.postId)) combined.push({ post: undefined, video });
    return combined.filter(({ video }) => filter === 'all' || (filter === 'approved' ? video?.reviewStatus === 'approved' : video?.reviewStatus !== 'approved'));
  }, [filter, posts, videos]);

  const pending = videos.filter((video) => video.reviewStatus === 'pending').length;
  const approved = videos.filter((video) => video.reviewStatus === 'approved').length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label={vi ? 'Tổng video' : 'Rendered'} value={videos.length} />
        <Summary label={vi ? 'Chờ kiểm duyệt' : 'Pending review'} value={pending} tone="pending" />
        <Summary label={vi ? 'Đã kiểm duyệt' : 'Approved'} value={approved} tone="approved" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved'] as ReviewFilter[]).map((value) => (
          <button key={value} className={cn('rounded-md border px-3 py-1.5 text-xs transition', filter === value ? 'border-accent bg-accent/10 text-sky-200' : 'border-border text-muted hover:text-text')} onClick={() => setFilter(value)}>
            {value === 'all' ? (vi ? 'Tất cả' : 'All') : value === 'pending' ? (vi ? 'Cần xử lý' : 'Needs action') : (vi ? 'Đã kiểm duyệt' : 'Approved')}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
        {rows.map(({ post, video }) => (
          <article key={post?.id ?? video?.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
            {video?.thumbnailDataUrl ? <img src={video.thumbnailDataUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" /> : <div className="grid h-20 w-14 shrink-0 place-items-center rounded border border-border bg-panelSoft"><Video className="size-5 text-muted" /></div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge video={video} vi={vi} onToggle={video && video.publishStatus !== 'published' ? () => onApprove(video.filePath, video.reviewStatus !== 'approved') : undefined} />
                {video ? <PublishBadge video={video} vi={vi} /> : null}
                <span className="text-xs text-muted">{formatDate(video?.createdAt ?? post?.fetchedAt, language)}</span>
              </div>
              <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-200">{post?.content ?? video?.label}</div>
              {post ? <div className="mt-1 text-xs text-muted">@{post.authorHandle || post.author}</div> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {post ? <Button className="h-9 px-2.5" icon={<ExternalLink className="size-4" />} onClick={() => onOpenLink(post)} /> : null}
              {!video && post ? <Button variant="primary" className="h-9" icon={<Video className="size-4" />} onClick={() => onOpenDraft(post)}>{vi ? 'Tạo video' : 'Create video'}</Button> : null}
              {video ? <Button className="h-9" icon={<Play className="size-4" />} onClick={() => onOpenVideo(video.filePath)}>{vi ? 'Xem video' : 'Open video'}</Button> : null}
              {video?.reviewStatus === 'approved' && video.publishStatus !== 'published' ? (
                <>
                <Button
                  className="h-9"
                  icon={<CheckCircle2 className="size-4" />}
                  onClick={() => {
                    setManualTarget(video);
                    setManualUrl('');
                    setManualCaption(normalizeTikTokCaption(video.publishCaption ?? ''));
                    setManualPublishMethod('tiktok_studio');
                    setManualUploadedAt(localDateTimeValue(new Date()));
                  }}
                >
                  {vi ? 'Đã đăng – ghi log' : 'Posted – record log'}
                </Button>
                <Button
                  variant="primary"
                  className="h-9"
                  icon={<Send className="size-4" />}
                  onClick={() => {
                    setPublishTarget(video);
                    setCaptionDraft(normalizeTikTokCaption(video.publishCaption ?? ''));
                  }}
                >
                  {vi ? 'Chuẩn bị đăng' : 'Prepare upload'}
                </Button>
                </>
              ) : null}
            </div>
          </article>
        ))}
        {!rows.length ? <div className="px-5 py-12 text-center text-sm text-muted">{vi ? 'Không có video trong trạng thái này.' : 'No videos in this state.'}</div> : null}
      </div>

      {publishTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onMouseDown={() => setPublishTarget(null)}>
          <section className="w-full max-w-xl rounded-lg border border-border bg-[#0c0f13] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">TikTok</div>
                <h2 className="mt-1 text-lg font-semibold text-text">{vi ? 'Đăng an toàn qua TikTok Studio' : 'Safe upload via TikTok Studio'}</h2>
              </div>
              <Button className="px-2" icon={<X className="size-4" />} onClick={() => setPublishTarget(null)} />
            </header>
            <div className="space-y-4 p-5">
              {publishTarget.publishStatus === 'verification_required' ? (
                <div className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-xs leading-5 text-rose-100">
                  {vi
                    ? 'TikTok có thể đã nhận lần đăng trước. Hãy kiểm tra profile TikTok trước; chỉ tiếp tục nếu bạn chắc chắn video chưa được đăng để tránh tạo bản trùng.'
                    : 'TikTok may have accepted the previous publish. Check your TikTok profile first and continue only if the video was not posted, to avoid a duplicate.'}
                </div>
              ) : null}
              <div className="rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-slate-300">
                <div className="text-xs text-muted">{vi ? 'Video sẽ đăng' : 'Video to publish'}</div>
                <div className="mt-1 truncate font-medium text-text">{publishTarget.filePath.split(/[\\/]/).pop()}</div>
              </div>
              <label className="grid gap-2 text-xs text-muted">
                {vi ? 'Caption (mặc định không hashtag)' : 'Caption (no hashtags by default)'}
                <textarea
                  autoFocus
                  className="min-h-40 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 text-text outline-none focus:border-accent"
                  maxLength={MAX_TIKTOK_CAPTION_LENGTH}
                  value={captionDraft}
                  onChange={(event) => setCaptionDraft(event.target.value)}
                />
              </label>
              <div className="text-right text-xs text-muted">{captionDraft.length}/{MAX_TIKTOK_CAPTION_LENGTH}</div>
              <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-100">
                {vi
                  ? 'App sẽ copy caption, mở đúng thư mục video và mở TikTok Studio trong trình duyệt thường. Bạn kéo file vào, chọn “Mọi người”, kiểm tra preview rồi tự bấm Đăng. Tool không còn điều khiển TikTok bằng Playwright.'
                  : 'The app will copy the caption, reveal the exact video, and open TikTok Studio in your normal browser. Drag in the file, choose Everyone, review the preview, then click Post yourself.'}
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button onClick={() => setPublishTarget(null)}>{vi ? 'Hủy' : 'Cancel'}</Button>
              <Button
                variant="primary"
                icon={<FolderOpen className="size-4" />}
                onClick={async () => {
                  const target = publishTarget;
                  setPublishTarget(null);
                  await onPrepareUpload(target.filePath, captionDraft);
                }}
              >
                {vi ? 'Copy caption và mở Studio' : 'Copy caption and open Studio'}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}

      {manualTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onMouseDown={() => setManualTarget(null)}>
          <section className="w-full max-w-lg rounded-lg border border-border bg-[#0c0f13] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">TikTok</div>
                <h2 className="mt-1 text-lg font-semibold text-text">{vi ? 'Ghi nhận đã đăng thủ công' : 'Record manual post'}</h2>
              </div>
              <Button className="px-2" icon={<X className="size-4" />} onClick={() => setManualTarget(null)} />
            </header>
            <div className="space-y-4 p-5">
              <div className="truncate rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-text">{manualTarget.filePath.split(/[\\/]/).pop()}</div>
              <label className="grid gap-2 text-xs text-muted">
                {vi ? 'Link bài TikTok (không bắt buộc)' : 'TikTok post URL (optional)'}
                <input className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text outline-none focus:border-accent" placeholder="https://www.tiktok.com/@.../video/..." type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} />
              </label>
              <label className="grid gap-2 text-xs text-muted">
                {vi ? 'Cách đã đăng' : 'Publishing method'}
                <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text outline-none focus:border-accent" value={manualPublishMethod} onChange={(event) => setManualPublishMethod(event.target.value as 'tiktok_studio' | 'mobile')}>
                  <option value="tiktok_studio">TikTok Studio · trình duyệt thường</option>
                  <option value="mobile">TikTok app · điện thoại</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs text-muted">
                {vi ? 'Caption thực tế đã đăng (không bắt buộc)' : 'Caption actually posted (optional)'}
                <textarea className="min-h-24 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 text-text outline-none focus:border-accent" maxLength={MAX_TIKTOK_CAPTION_LENGTH} value={manualCaption} onChange={(event) => setManualCaption(event.target.value)} />
              </label>
              <label className="grid gap-2 text-xs text-muted">
                {vi ? 'Thời điểm đã đăng' : 'Published at'}
                <input className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text outline-none focus:border-accent" type="datetime-local" value={manualUploadedAt} onChange={(event) => setManualUploadedAt(event.target.value)} />
              </label>
              <div className="rounded-md border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-xs leading-5 text-sky-100">
                {vi ? 'Thao tác này sẽ chuyển video sang Đã đăng và tạo một dòng trong Upload log để theo dõi hiệu suất.' : 'This marks the video as published and creates an Upload log entry for performance tracking.'}
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button onClick={() => setManualTarget(null)}>{vi ? 'Hủy' : 'Cancel'}</Button>
              <Button
                variant="primary"
                icon={<CheckCircle2 className="size-4" />}
                disabled={!manualUploadedAt}
                onClick={async () => {
                  const target = manualTarget;
                  const uploadedAt = new Date(manualUploadedAt);
                  if (Number.isNaN(uploadedAt.getTime())) return;
                  setManualTarget(null);
                  await onMarkManual(target.filePath, {
                    publishedUrl: manualUrl.trim(),
                    caption: manualCaption,
                    uploadedAt: uploadedAt.toISOString(),
                    publishMethod: manualPublishMethod
                  });
                }}
              >
                {vi ? 'Xác nhận đã đăng' : 'Confirm posted'}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PublishBadge({ video, vi }: { video: GeneratedVideoItem; vi: boolean }) {
  if (video.publishStatus === 'not_published') return null;
  if (video.publishStatus === 'published') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-1 text-[11px] text-sky-300"><Send className="size-3" />{vi ? 'Đã đăng' : 'Published'}</span>;
  }
  return (
    <span title={video.publishError} className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-[11px] text-amber-300">
      <CircleDashed className="size-3" />{vi ? 'Trạng thái từ automation cũ' : 'Legacy automation state'}
    </span>
  );
}

function StatusBadge({ video, vi, onToggle }: { video?: GeneratedVideoItem; vi: boolean; onToggle?: () => void }) {
  if (!video) return <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2 py-1 text-[11px] text-slate-300"><CircleDashed className="size-3" />{vi ? 'Chưa render' : 'Not rendered'}</span>;
  const approved = video.reviewStatus === 'approved';
  return (
    <button
      type="button"
      title={approved ? (vi ? 'Bấm để chuyển về Chờ kiểm duyệt' : 'Mark as pending') : (vi ? 'Bấm để xác nhận Đã kiểm duyệt' : 'Mark as approved')}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition hover:ring-1 focus:outline-none focus:ring-2 focus:ring-accent/50',
        approved ? 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 hover:ring-emerald-400/40' : 'bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:ring-amber-400/40'
      )}
      onClick={onToggle}
    >
      {approved ? <CheckCircle2 className="size-3" /> : <CircleDashed className="size-3" />}
      {approved ? (vi ? 'Đã kiểm duyệt' : 'Approved') : (vi ? 'Chờ kiểm duyệt' : 'Pending review')}
    </button>
  );
}

function Summary({ label, tone, value }: { label: string; tone?: 'pending' | 'approved'; value: number }) {
  return <div className="rounded-lg border border-border bg-panel p-4"><div className="text-xs text-muted">{label}</div><div className={cn('mt-1 text-2xl font-semibold', tone === 'approved' ? 'text-emerald-300' : tone === 'pending' ? 'text-amber-300' : 'text-text')}>{value}</div></div>;
}

function formatDate(value: string | undefined, language: 'en' | 'vi') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
