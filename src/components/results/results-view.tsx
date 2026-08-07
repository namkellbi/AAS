'use client';

import { Bookmark, Clock3, ExternalLink, Eye, Heart, LoaderCircle, MessageCircle, Pencil, RefreshCcw, Share2, Trash2, TrendingUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, Product, ReadinessThresholds, ThreadsPost, UploadLogEntry, UsageSummary } from '@/lib/types';
import { cn, compactNumber } from '@/lib/utils';

export function ResultsView({ logs, posts, onDelete, onSave, onSync }: {
  analyses: AIAnalysis[];
  copy: TranslationCopy;
  logs: UploadLogEntry[];
  posts: ThreadsPost[];
  products: Product[];
  thresholds: ReadinessThresholds;
  usage: UsageSummary | null;
  onDelete: (id: string) => Promise<void>;
  onSave: (entry: UploadLogEntry) => Promise<void>;
  onSync: () => Promise<void>;
  onSaveThresholds: (thresholds: Partial<ReadinessThresholds>) => void;
}) {
  const [editing, setEditing] = useState<UploadLogEntry | null>(null);
  const [syncing, setSyncing] = useState(false);
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const ordered = useMemo(() => [...logs].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [logs]);
  const totals = useMemo(() => ordered.reduce((result, log) => ({
    views: result.views + metric(log.views),
    engagement: result.engagement + metric(log.likes) + metric(log.comments) + metric(log.saves) + metric(log.shares),
    followers: result.followers + metric(log.followersGained)
  }), { views: 0, engagement: 0, followers: 0 }), [ordered]);
  const averageViews = ordered.length ? Math.round(totals.views / ordered.length) : 0;
  const engagementRate = totals.views ? (totals.engagement / totals.views) * 100 : 0;
  const postingSlots = useMemo(() => buildPostingSlots(ordered), [ordered]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Theo dõi video TikTok</h2>
          <p className="mt-1 text-sm text-muted">Ghi nhận kết quả sau khi đăng để tìm ra khung giờ và kiểu nội dung phù hợp với chính tài khoản này.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">{ordered.length}/15 video trước khi đủ dữ liệu gợi ý</div>
          <Button
            variant="primary"
            icon={syncing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            disabled={syncing || !ordered.length}
            onClick={async () => { setSyncing(true); try { await onSync(); } finally { setSyncing(false); } }}
          >
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ TikTok'}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Video đã đăng" value={String(ordered.length)} helper="Được ghi tự động" />
        <Metric label="Tổng lượt xem" value={compactNumber(totals.views)} helper={`Trung bình ${compactNumber(averageViews)}/video`} />
        <Metric label="Tỷ lệ tương tác" value={`${engagementRate.toFixed(1)}%`} helper="Like + comment + lưu + chia sẻ" />
        <Metric label="Follower tài khoản tăng" value={`+${compactNumber(totals.followers)}`} helper="So với lúc bắt đầu theo dõi tài khoản" accent />
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><TrendingUp className="size-4 text-sky-300" /><h3 className="text-sm font-semibold text-text">Khung giờ đang hiệu quả</h3></div>
            <p className="mt-1 text-xs text-muted">Dùng median views; chỉ kết luận khi mỗi khung giờ có đủ mẫu.</p>
          </div>
          <span className="text-xs text-muted">Giờ Việt Nam</span>
        </div>
        {postingSlots.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {postingSlots.map((slot, index) => (
              <div key={slot.hour} className={cn('rounded-md border p-3', index === 0 ? 'border-sky-400/30 bg-sky-400/5' : 'border-border bg-panelSoft')}>
                <div className="flex justify-between gap-3"><span className="text-sm font-semibold text-text">{hourRange(slot.hour)}</span><span className="text-[11px] text-muted">{slot.samples} video</span></div>
                <div className="mt-2 text-xl font-semibold text-sky-200">{compactNumber(slot.medianViews)} views</div>
                <div className="mt-1 text-xs text-muted">Median · tương tác {slot.medianEngagement.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-border p-5 text-center">
            <div className="text-sm font-medium text-text">Chưa đủ dữ liệu để so sánh khung giờ</div>
            <div className="mt-1 text-xs text-muted">Hãy cập nhật views cho ít nhất 2 video cùng một khung giờ. Gợi ý đáng tin hơn sau khoảng 15–20 video.</div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-panel">
        <header className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Lịch sử đã đăng</h3></header>
        {ordered.length ? (
          <div className="divide-y divide-border">
            {ordered.map((log) => (
              <VideoRow
                key={log.id}
                log={log}
                post={postById.get(log.postId)}
                onEdit={() => setEditing(log)}
                onDelete={() => void onDelete(log.id)}
              />
            ))}
          </div>
        ) : <EmptyState text="Video xuất bản thành công sẽ tự xuất hiện tại đây." />}
      </section>

      {editing ? <MetricsModal log={editing} onClose={() => setEditing(null)} onSave={async (next) => { await onSave(next); setEditing(null); }} /> : null}
    </div>
  );
}

function VideoRow({ log, post, onDelete, onEdit }: { log: UploadLogEntry; post?: ThreadsPost; onDelete?: () => void; onEdit: () => void }) {
  return (
    <article className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-medium text-text">{post?.content || log.hook || 'Video TikTok'}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{formatPublishedAt(log.uploadedAt)}</span>
          <span>{formatAge(log.uploadedAt)}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3 text-center lg:w-[420px]">
        <SmallMetric icon={<Eye className="size-3.5" />} value={metric(log.views)} />
        <SmallMetric icon={<Heart className="size-3.5" />} value={metric(log.likes)} />
        <SmallMetric icon={<MessageCircle className="size-3.5" />} value={metric(log.comments)} />
        <SmallMetric icon={<Bookmark className="size-3.5" />} value={metric(log.saves)} />
        <SmallMetric icon={<Share2 className="size-3.5" />} value={metric(log.shares)} />
      </div>
      <div className="flex shrink-0 gap-2">
        {log.tiktokUrl ? <Button className="px-2" icon={<ExternalLink className="size-4" />} onClick={() => window.open(log.tiktokUrl)} /> : null}
        <Button icon={<Pencil className="size-4" />} onClick={onEdit}>Cập nhật</Button>
        {onDelete ? <Button className="px-2 text-rose-300" icon={<Trash2 className="size-4" />} onClick={onDelete} /> : null}
      </div>
    </article>
  );
}

function MetricsModal({ log, onClose, onSave }: { log: UploadLogEntry; onClose: () => void; onSave: (log: UploadLogEntry) => Promise<void> }) {
  const [draft, setDraft] = useState(log);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onMouseDown={onClose}>
      <section className="w-full max-w-lg rounded-lg border border-border bg-[#0c0f13] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="text-xs uppercase tracking-[0.14em] text-accent">TikTok Analytics</div><h2 className="mt-1 text-lg font-semibold text-text">Cập nhật số liệu</h2></div><Button className="px-2" icon={<X className="size-4" />} onClick={onClose} /></header>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <NumberField label="Lượt xem" value={metric(draft.views)} onChange={(views) => setDraft({ ...draft, views })} />
          <NumberField label="Lượt thích" value={metric(draft.likes)} onChange={(likes) => setDraft({ ...draft, likes })} />
          <NumberField label="Bình luận" value={metric(draft.comments)} onChange={(comments) => setDraft({ ...draft, comments })} />
          <NumberField label="Lượt lưu" value={metric(draft.saves)} onChange={(saves) => setDraft({ ...draft, saves })} />
          <NumberField label="Chia sẻ" value={metric(draft.shares)} onChange={(shares) => setDraft({ ...draft, shares })} />
          <NumberField label="Follower tăng" value={metric(draft.followersGained)} onChange={(followersGained) => setDraft({ ...draft, followersGained })} />
          <label className="grid gap-1.5 text-xs text-muted">Mốc theo dõi<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as UploadLogEntry['status'] })}><option value="published">Mới đăng</option><option value="tracking">Đang theo dõi</option><option value="winner">Hiệu suất tốt</option><option value="stopped">Dừng theo dõi</option></select></label>
          <label className="grid gap-1.5 text-xs text-muted sm:col-span-2">Ghi chú<Input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4"><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={() => void onSave(draft)}>Lưu số liệu</Button></footer>
      </section>
    </div>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <label className="grid gap-1.5 text-xs text-muted">{label}<Input type="number" min="0" value={String(value)} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /></label>;
}

function Metric({ accent, helper, label, value }: { accent?: boolean; helper: string; label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-panel p-4"><div className="text-xs text-muted">{label}</div><div className={cn('mt-2 text-2xl font-semibold text-text', accent && 'text-emerald-300')}>{value}</div><div className="mt-1 text-[11px] text-muted">{helper}</div></div>;
}

function SmallMetric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return <div><div className="flex items-center justify-center gap-1 text-muted">{icon}<span className="text-xs">{compactNumber(value)}</span></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-sm text-muted">{text}</div>;
}

function buildPostingSlots(logs: UploadLogEntry[]) {
  const grouped = new Map<number, UploadLogEntry[]>();
  for (const log of logs.filter((item) => metric(item.views) > 0)) {
    const date = new Date(log.uploadedAt);
    if (Number.isNaN(date.getTime())) continue;
    grouped.set(date.getHours(), [...(grouped.get(date.getHours()) ?? []), log]);
  }
  return [...grouped.entries()]
    .filter(([, entries]) => entries.length >= 2)
    .map(([hour, entries]) => ({ hour, samples: entries.length, medianViews: median(entries.map((entry) => metric(entry.views))), medianEngagement: median(entries.map((entry) => metric(entry.views) ? ((metric(entry.likes) + metric(entry.comments) + metric(entry.saves) + metric(entry.shares)) / metric(entry.views)) * 100 : 0)) }))
    .sort((a, b) => b.medianViews - a.medianViews || b.samples - a.samples)
    .slice(0, 3);
}

function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function hourRange(hour: number) { return `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`; }
function hoursSince(value: string) { return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000); }
function formatAge(value: string) { const hours = hoursSince(value); return hours < 1 ? 'Vừa đăng' : hours < 24 ? `${Math.floor(hours)} giờ trước` : `${Math.floor(hours / 24)} ngày trước`; }
function formatPublishedAt(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date); }
function metric(value: number | undefined) { return Number.isFinite(value) ? Number(value) : 0; }
