'use client';

import { Bookmark, ExternalLink, Eye, Lightbulb, Radar, Sparkles, Target, TrendingUp, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, OpportunityScanProgress, ThreadsPost, UploadLogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export function OpportunityInbox({
  analyses,
  copy,
  isScanning,
  logs,
  posts,
  savedIds,
  scanProgress,
  scanSummary,
  onCreate,
  onInspect,
  onOpenLink,
  onSave,
  onScan
}: {
  analyses: Record<string, AIAnalysis>;
  copy: TranslationCopy;
  isScanning: boolean;
  logs: UploadLogEntry[];
  posts: ThreadsPost[];
  savedIds: Set<string>;
  scanProgress: OpportunityScanProgress | null;
  scanSummary: { newPosts: number; seenPosts: number } | null;
  onCreate: (post: ThreadsPost) => void;
  onInspect: (post: ThreadsPost) => void;
  onOpenLink: (post: ThreadsPost) => void;
  onSave: (post: ThreadsPost) => void;
  onScan: () => void;
}) {
  const shortlist = [...posts]
    .filter((post) => analyses[post.id] && analyses[post.id].verdict !== 'skip')
    .sort((a, b) => opportunityPriority(b, analyses[b.id]) - opportunityPriority(a, analyses[a.id]))
    .slice(0, 8);
  const makeNowCount = shortlist.filter((post) => analyses[post.id]?.verdict === 'make_now').length;
  const watchCount = shortlist.filter((post) => analyses[post.id]?.verdict !== 'make_now').length;
  const readyCount = shortlist.filter((post) => Boolean(analyses[post.id]?.videoScript.postReadVersion)).length;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InboxMetric icon={<Target className="size-4" />} label={copy.makeNow} value={makeNowCount} tone="success" />
        <InboxMetric icon={<Eye className="size-4" />} label={copy.watch} value={watchCount} tone="warning" />
        <InboxMetric icon={<Video className="size-4" />} label={copy.readyToCreate} value={readyCount} />
        <InboxMetric icon={<TrendingUp className="size-4" />} label={copy.trackedResults} value={logs.length} />
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text">{copy.todayShortlist}</h2>
            <p className="mt-1 text-sm text-muted">{copy.todayShortlistHelp}</p>
            {scanSummary ? <p className="mt-2 text-xs text-sky-200">{scanSummary.newPosts} {copy.newPosts} · {scanSummary.seenPosts} {copy.seenPosts}</p> : null}
          </div>
          <Button variant="primary" icon={<Radar className={cn('size-4', isScanning && 'animate-spin')} />} disabled={isScanning} onClick={onScan}>
            {isScanning ? copy.scanningOpportunities : copy.scanOpportunities}
          </Button>
        </div>
        {isScanning && scanProgress ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span className="truncate">{scanProgress.message}</span>
              <span>{scanProgress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${scanProgress.percent}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        {shortlist.map((post) => {
          const analysis = analyses[post.id];
          const saved = savedIds.has(post.id);
          return (
            <article key={post.id} className="rounded-lg border border-border bg-panel p-4 transition hover:border-accent/50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{post.author}</span>
                    <VerdictBadge analysis={analysis} copy={copy} />
                    {post.keyword ? <span className="rounded-md border border-border px-2 py-1 text-[11px] text-muted">{post.keyword}</span> : null}
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-200">{post.content}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <DecisionItem label={copy.whyWorthMaking} value={analysis?.whyViral || copy.pendingAiShortlist} />
                <DecisionItem label={copy.productToPromote} value={analysis?.affiliateProducts[0] || copy.pendingAiShortlist} />
                <DecisionItem label={copy.suggestedHook} value={analysis?.hooks[0] || copy.pendingAiShortlist} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" icon={<Lightbulb className="size-4" />} disabled={!analysis} onClick={() => onCreate(post)}>
                  {copy.createContent}
                </Button>
                <Button icon={<Eye className="size-4" />} onClick={() => onInspect(post)}>{copy.inspectPost}</Button>
                <Button icon={<Bookmark className={cn('size-4', saved && 'fill-current')} />} variant={saved ? 'primary' : 'secondary'} onClick={() => onSave(post)}>
                  {saved ? copy.saved : copy.savePost}
                </Button>
                <Button icon={<ExternalLink className="size-4" />} onClick={() => onOpenLink(post)}>{copy.openLink}</Button>
              </div>
            </article>
          );
        })}
        {!shortlist.length ? (
          <div className="rounded-lg border border-border bg-panel p-8 text-center">
            <Sparkles className="mx-auto size-5 text-accent" />
            <div className="mt-3 text-sm font-medium text-text">{copy.noShortlistYet}</div>
            <div className="mt-1 text-sm text-muted">{copy.noShortlistHelp}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function opportunityPriority(post: ThreadsPost, analysis?: AIAnalysis) {
  const verdict = analysis?.verdict === 'make_now' ? 300 : analysis?.verdict === 'watch' ? 150 : 0;
  return verdict + (analysis?.confidenceScore ?? 0) + post.opportunityScore;
}

function VerdictBadge({ analysis, copy }: { analysis?: AIAnalysis; copy: TranslationCopy }) {
  const verdict = analysis?.verdict ?? 'watch';
  const label = verdict === 'make_now' ? copy.makeNow : verdict === 'skip' ? copy.skip : copy.watch;
  return (
    <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold uppercase', verdict === 'make_now' ? 'bg-success/15 text-emerald-200' : verdict === 'skip' ? 'bg-danger/15 text-rose-200' : 'bg-warning/15 text-amber-200')}>
      {label}
    </span>
  );
}

function DecisionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panelSoft p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-2 line-clamp-3 text-sm leading-5 text-slate-200">{value}</div>
    </div>
  );
}

function InboxMetric({ icon, label, tone, value }: { icon: ReactNode; label: string; tone?: 'success' | 'warning'; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center gap-2 text-xs text-muted">{icon}{label}</div>
      <div className={cn('mt-3 text-2xl font-semibold text-text', tone === 'success' && 'text-emerald-200', tone === 'warning' && 'text-amber-200')}>{value}</div>
    </div>
  );
}
