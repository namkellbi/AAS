'use client';

import { CheckCircle2, ExternalLink, Pencil, Plus, Trash2, TrendingUp, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, Product, ReadinessThresholds, ThreadsPost, UploadLogEntry, UsageSummary } from '@/lib/types';
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
  note: '',
  contentGoal: 'affiliate',
  followersGained: 0,
  comments: 0,
  saves: 0,
  shares: 0,
  variantLabel: ''
});

export function ResultsView({
  analyses,
  copy,
  logs,
  posts,
  products,
  thresholds,
  usage,
  onDelete,
  onSave,
  onSaveThresholds
}: {
  analyses: AIAnalysis[];
  copy: TranslationCopy;
  logs: UploadLogEntry[];
  posts: ThreadsPost[];
  products: Product[];
  thresholds: ReadinessThresholds;
  usage: UsageSummary | null;
  onDelete: (id: string) => Promise<void>;
  onSave: (entry: UploadLogEntry) => Promise<void>;
  onSaveThresholds: (thresholds: Partial<ReadinessThresholds>) => void;
}) {
  const [draft, setDraft] = useState<UploadLogEntry>(() => emptyEntry(posts[0]?.id));
  const [editing, setEditing] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<ReadinessThresholds>(thresholds);
  useEffect(() => {
    if (!draft.postId && posts[0]) setDraft((current) => ({ ...current, postId: posts[0].id }));
  }, [draft.postId, posts]);
  useEffect(() => {
    setThresholdDraft(thresholds);
  }, [thresholds]);

  const readiness = useMemo(() => {
    const recent = [...logs].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 10);
    const recentViews = recent.reduce((sum, item) => sum + item.views, 0);
    const avgViews = recent.length ? Math.round(recentViews / recent.length) : 0;
    const engagementActions = recent.reduce((sum, item) => sum + item.comments + item.saves + item.shares, 0);
    const engagementRatePct = recentViews ? (engagementActions / recentViews) * 100 : 0;
    const followersTotal = logs.reduce((sum, item) => sum + item.followersGained, 0);
    const streak = postingStreak(logs);
    const engagementCount = recent.filter((item) => item.contentGoal === 'engagement').length;
    return { avgViews, engagementRatePct, followersTotal, streak, engagementCount, recentCount: recent.length };
  }, [logs]);
  const readinessChecks = [
    { label: copy.avgRecentViews, value: compactNumber(readiness.avgViews), pass: readiness.avgViews >= thresholds.avgViews, target: compactNumber(thresholds.avgViews) },
    { label: copy.engagementRate, value: `${readiness.engagementRatePct.toFixed(1)}%`, pass: readiness.engagementRatePct >= thresholds.engagementRatePct, target: `${thresholds.engagementRatePct}%` },
    { label: copy.postingStreak, value: String(readiness.streak), pass: readiness.streak >= thresholds.streakDays, target: String(thresholds.streakDays) },
    { label: copy.followersGained, value: compactNumber(readiness.followersTotal), pass: readiness.followersTotal >= thresholds.followersGained, target: compactNumber(thresholds.followersGained) }
  ];
  const readyForAffiliate = readinessChecks.every((check) => check.pass);

  const totals = useMemo(() => logs.reduce((sum, item) => ({
    views: sum.views + item.views,
    clicks: sum.clicks + item.clicks,
    orders: sum.orders + item.orders,
    commission: sum.commission + item.commission
  }), { views: 0, clicks: 0, orders: 0, commission: 0 }), [logs]);
  const clickRate = totals.views ? (totals.clicks / totals.views) * 100 : 0;
  const conversionRate = totals.clicks ? (totals.orders / totals.clicks) * 100 : 0;
  const winners = [...logs].filter((item) => item.orders > 0 || item.commission > 0).sort((a, b) => b.commission - a.commission || b.orders - a.orders).slice(0, 3);
  const publishedCount = logs.filter((item) => item.status !== 'stopped').length;
  const commissionPerVideo = publishedCount ? totals.commission / publishedCount : 0;
  const makeNowAnalyses = analyses.filter((item) => item.verdict === 'make_now');
  const postedPostIds = new Set(logs.map((item) => item.postId));
  const makeNowPostedRate = makeNowAnalyses.length ? (makeNowAnalyses.filter((item) => postedPostIds.has(item.postId)).length / makeNowAnalyses.length) * 100 : 0;

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResultMetric label={copy.costPerDraft} value={usage ? `$${usage.costPerDraft.toFixed(2)}` : '—'} />
        <ResultMetric label={copy.commissionPerVideo} value={currency(commissionPerVideo)} />
        <ResultMetric label={copy.makeNowPostedRate} value={`${makeNowPostedRate.toFixed(0)}%`} />
        <ResultMetric label={copy.todayApiCost} value={usage ? `$${usage.todayUsd.toFixed(2)}` : '—'} />
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">{copy.channelReadiness}</h3>
            <p className="mt-1 text-xs text-muted">{copy.readinessHelp}</p>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold', readyForAffiliate ? 'bg-success/15 text-emerald-200' : 'bg-warning/15 text-amber-200')}>
            {readyForAffiliate ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            {copy.readyForAffiliate}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {readinessChecks.map((check) => (
            <div key={check.label} className={cn('rounded-md border p-3', check.pass ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-panelSoft')}>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{check.label}</div>
              <div className={cn('mt-2 text-xl font-semibold', check.pass ? 'text-emerald-200' : 'text-text')}>{check.value}</div>
              <div className="mt-1 text-[11px] text-muted">≥ {check.target}</div>
            </div>
          ))}
        </div>
        {readiness.recentCount ? (
          <div className="mt-3 text-xs text-muted">{copy.contentMix}: {readiness.engagementCount} {copy.goalEngagement.toLowerCase()} · {readiness.recentCount - readiness.engagementCount} {copy.goalAffiliate.toLowerCase()}</div>
        ) : null}
        <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-5">
          <NumberInput label={copy.avgRecentViews} value={thresholdDraft.avgViews} onChange={(avgViews) => setThresholdDraft({ ...thresholdDraft, avgViews })} />
          <NumberInput label={`${copy.engagementRate} (%)`} value={thresholdDraft.engagementRatePct} onChange={(engagementRatePct) => setThresholdDraft({ ...thresholdDraft, engagementRatePct })} />
          <NumberInput label={copy.postingStreak} value={thresholdDraft.streakDays} onChange={(streakDays) => setThresholdDraft({ ...thresholdDraft, streakDays })} />
          <NumberInput label={copy.followersGained} value={thresholdDraft.followersGained} onChange={(followersGained) => setThresholdDraft({ ...thresholdDraft, followersGained })} />
          <div className="flex items-end">
            <Button onClick={() => onSaveThresholds(thresholdDraft)}>{copy.save}</Button>
          </div>
        </div>
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
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text"
            value={draft.productId ?? ''}
            onChange={(event) => {
              const product = products.find((item) => item.id === event.target.value);
              setDraft({ ...draft, productId: product?.id, productName: product ? product.name : draft.productName });
            }}
          >
            <option value="">{copy.chooseProduct}</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <Input placeholder={copy.productName} value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} />
          <Input placeholder={copy.hookUsed} value={draft.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} />
          <Input placeholder={copy.formatUsed} value={draft.contentFormat} onChange={(event) => setDraft({ ...draft, contentFormat: event.target.value })} />
          <NumberInput label={copy.views} value={draft.views} onChange={(views) => setDraft({ ...draft, views })} />
          <NumberInput label={copy.clicks} value={draft.clicks} onChange={(clicks) => setDraft({ ...draft, clicks })} />
          <NumberInput label={copy.orders} value={draft.orders} onChange={(orders) => setDraft({ ...draft, orders })} />
          <NumberInput label={copy.revenue} value={draft.revenue} onChange={(revenue) => setDraft({ ...draft, revenue })} />
          <NumberInput label={copy.commission} value={draft.commission} onChange={(commission) => setDraft({ ...draft, commission })} />
          <label className="grid gap-1.5 text-[11px] font-medium text-muted">
            {copy.contentGoal}
            <select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={draft.contentGoal} onChange={(event) => setDraft({ ...draft, contentGoal: event.target.value === 'engagement' ? 'engagement' : 'affiliate' })}>
              <option value="affiliate">{copy.goalAffiliate}</option>
              <option value="engagement">{copy.goalEngagement}</option>
            </select>
          </label>
          <NumberInput label={copy.commentsMetric} value={draft.comments} onChange={(comments) => setDraft({ ...draft, comments })} />
          <NumberInput label={copy.savesMetric} value={draft.saves} onChange={(saves) => setDraft({ ...draft, saves })} />
          <NumberInput label={copy.sharesMetric} value={draft.shares} onChange={(shares) => setDraft({ ...draft, shares })} />
          <NumberInput label={copy.followersGained} value={draft.followersGained} onChange={(followersGained) => setDraft({ ...draft, followersGained })} />
          <Input placeholder={copy.variantLabelField} value={draft.variantLabel} onChange={(event) => setDraft({ ...draft, variantLabel: event.target.value })} />
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

function postingStreak(logs: UploadLogEntry[]): number {
  const days = [...new Set(logs.map((log) => log.uploadedAt.slice(0, 10)))].sort().reverse();
  if (!days.length) return 0;
  let streak = 1;
  let current = new Date(`${days[0]}T00:00:00Z`).getTime();
  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(`${days[index]}T00:00:00Z`).getTime();
    if (Math.round((current - previous) / 86_400_000) === 1) {
      streak += 1;
      current = previous;
    } else {
      break;
    }
  }
  return streak;
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
