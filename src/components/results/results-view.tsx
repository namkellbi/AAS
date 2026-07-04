'use client';

import { ExternalLink, Pencil, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { ThreadsPost, UploadLogEntry } from '@/lib/types';
import { cn, compactNumber } from '@/lib/utils';

const emptyEntry = (postId = ''): UploadLogEntry => ({
  id: '',
  postId,
  tiktokUrl: '',
  productName: '',
  hook: '',
  contentFormat: '',
  uploadedAt: new Date().toISOString(),
  views: 0,
  clicks: 0,
  orders: 0,
  revenue: 0,
  commission: 0,
  status: 'published',
  note: ''
});

export function ResultsView({
  copy,
  logs,
  posts,
  onDelete,
  onSave
}: {
  copy: TranslationCopy;
  logs: UploadLogEntry[];
  posts: ThreadsPost[];
  onDelete: (id: string) => Promise<void>;
  onSave: (entry: UploadLogEntry) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UploadLogEntry>(() => emptyEntry(posts[0]?.id));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!draft.postId && posts[0]) setDraft((current) => ({ ...current, postId: posts[0].id }));
  }, [draft.postId, posts]);

  const totals = useMemo(() => logs.reduce((sum, item) => ({
    views: sum.views + item.views,
    clicks: sum.clicks + item.clicks,
    orders: sum.orders + item.orders,
    commission: sum.commission + item.commission
  }), { views: 0, clicks: 0, orders: 0, commission: 0 }), [logs]);
  const clickRate = totals.views ? (totals.clicks / totals.views) * 100 : 0;
  const conversionRate = totals.clicks ? (totals.orders / totals.clicks) * 100 : 0;
  const winners = [...logs].filter((item) => item.orders > 0 || item.commission > 0).sort((a, b) => b.commission - a.commission || b.orders - a.orders).slice(0, 3);

  async function saveDraft() {
    if (!draft.postId) return;
    await onSave({ ...draft, id: draft.id || crypto.randomUUID(), uploadedAt: draft.uploadedAt || new Date().toISOString() });
    setDraft(emptyEntry(posts[0]?.id));
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">{copy.results}</h2>
        <p className="mt-1 text-sm text-muted">{copy.resultsHelp}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResultMetric label={copy.totalViews} value={compactNumber(totals.views)} />
        <ResultMetric label={copy.clickRate} value={`${clickRate.toFixed(1)}%`} />
        <ResultMetric label={copy.orderConversion} value={`${conversionRate.toFixed(1)}%`} />
        <ResultMetric label={copy.totalCommission} value={currency(totals.commission)} accent />
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">{editing ? copy.editResult : copy.addResult}</h3>
            <p className="mt-1 text-xs text-muted">{copy.resultFormHelp}</p>
          </div>
          {editing ? <Button className="px-2" icon={<X className="size-4" />} onClick={() => {
            setDraft(emptyEntry(posts[0]?.id));
            setEditing(false);
          }} /> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.postId} onChange={(event) => setDraft({ ...draft, postId: event.target.value })}>
            <option value="">{copy.chooseSourcePost}</option>
            {posts.map((post) => <option key={post.id} value={post.id}>{post.author}: {post.content.slice(0, 44)}</option>)}
          </select>
          <Input placeholder="TikTok URL" value={draft.tiktokUrl} onChange={(event) => setDraft({ ...draft, tiktokUrl: event.target.value })} />
          <Input placeholder={copy.productName} value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} />
          <Input placeholder={copy.hookUsed} value={draft.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} />
          <Input placeholder={copy.formatUsed} value={draft.contentFormat} onChange={(event) => setDraft({ ...draft, contentFormat: event.target.value })} />
          <NumberInput label={copy.views} value={draft.views} onChange={(views) => setDraft({ ...draft, views })} />
          <NumberInput label={copy.clicks} value={draft.clicks} onChange={(clicks) => setDraft({ ...draft, clicks })} />
          <NumberInput label={copy.orders} value={draft.orders} onChange={(orders) => setDraft({ ...draft, orders })} />
          <NumberInput label={copy.revenue} value={draft.revenue} onChange={(revenue) => setDraft({ ...draft, revenue })} />
          <NumberInput label={copy.commission} value={draft.commission} onChange={(commission) => setDraft({ ...draft, commission })} />
          <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as UploadLogEntry['status'] })}>
            <option value="published">{copy.published}</option>
            <option value="tracking">{copy.tracking}</option>
            <option value="winner">{copy.winner}</option>
            <option value="stopped">{copy.stopped}</option>
          </select>
          <Input placeholder={copy.note} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </div>
        <Button className="mt-3" variant="primary" icon={<Plus className="size-4" />} disabled={!draft.postId} onClick={saveDraft}>
          {editing ? copy.saveChanges : copy.addResult}
        </Button>
      </section>

      {winners.length ? (
        <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><TrendingUp className="size-4" />{copy.learnedSignals}</div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {winners.map((item) => (
              <div key={item.id} className="rounded-md border border-emerald-500/15 bg-background/50 p-3">
                <div className="text-sm font-medium text-text">{item.productName || copy.unknownProduct}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted">{item.hook || item.contentFormat || copy.noHookRecorded}</div>
                <div className="mt-2 text-xs text-emerald-200">{item.orders} {copy.orders.toLowerCase()} · {currency(item.commission)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        {logs.map((log) => (
          <article key={log.id} className="rounded-lg border border-border bg-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{log.productName || copy.unknownProduct}</span>
                  <StatusBadge status={log.status} copy={copy} />
                </div>
                <div className="mt-2 text-xs text-muted">{log.uploadedAt.slice(0, 10)} · {compactNumber(log.views)} views · {compactNumber(log.clicks)} clicks · {log.orders} orders · {currency(log.commission)}</div>
                {log.hook ? <div className="mt-2 line-clamp-2 text-sm text-slate-300">{log.hook}</div> : null}
              </div>
              <div className="flex gap-2">
                {log.tiktokUrl ? <Button className="px-2" icon={<ExternalLink className="size-4" />} onClick={() => window.open(log.tiktokUrl)} /> : null}
                <Button className="px-2" icon={<Pencil className="size-4" />} onClick={() => {
                  setDraft(log);
                  setEditing(true);
                }} />
                <Button className="px-2" icon={<Trash2 className="size-4" />} onClick={() => void onDelete(log.id)} />
              </div>
            </div>
          </article>
        ))}
        {!logs.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">{copy.noResultsYet}</div> : null}
      </section>
    </div>
  );
}

function NumberInput({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-muted">
      {label}
      <Input type="number" min="0" step="1" value={String(value)} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />
    </label>
  );
}

function ResultMetric({ accent, label, value }: { accent?: boolean; label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-panel p-4"><div className="text-xs text-muted">{label}</div><div className={cn('mt-3 text-2xl font-semibold text-text', accent && 'text-emerald-200')}>{value}</div></div>;
}

function StatusBadge({ copy, status }: { copy: TranslationCopy; status: UploadLogEntry['status'] }) {
  const labels = { published: copy.published, tracking: copy.tracking, winner: copy.winner, stopped: copy.stopped };
  return <span className={cn('rounded-md px-2 py-1 text-[11px] font-medium', status === 'winner' ? 'bg-success/15 text-emerald-200' : status === 'stopped' ? 'bg-danger/15 text-rose-200' : 'bg-panelSoft text-muted')}>{labels[status]}</span>;
}

function currency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}
