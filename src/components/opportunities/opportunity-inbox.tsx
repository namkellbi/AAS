'use client';

import { Bookmark, CheckCircle2, Circle, ExternalLink, Eye, Lightbulb, Link2, Radar, Sparkles, Target, TrendingUp, Video, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, ContentGoal, CreateFromLinkProgress, OpportunityScanProgress, ThreadsPost, UploadLogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export type SetupState = {
  apiKey: boolean;
  threadsLogin: boolean;
  background: boolean;
  keywords: boolean;
};

export function OpportunityInbox({
  analyses,
  copy,
  createLinkProgress,
  createLinkUrl,
  isCreatingFromLink,
  isScanning,
  logs,
  posts,
  savedIds,
  scanGoal,
  scanProgress,
  scanSummary,
  setup,
  onCreate,
  onCreateFromLink,
  onCreateLinkUrl,
  onInspect,
  onNavigate,
  onOpenLink,
  onSave,
  onScan,
  onScanGoal
}: {
  analyses: Record<string, AIAnalysis>;
  copy: TranslationCopy;
  createLinkProgress: CreateFromLinkProgress | null;
  createLinkUrl: string;
  isCreatingFromLink: boolean;
  isScanning: boolean;
  logs: UploadLogEntry[];
  posts: ThreadsPost[];
  savedIds: Set<string>;
  scanGoal: ContentGoal;
  scanProgress: OpportunityScanProgress | null;
  scanSummary: { newPosts: number; seenPosts: number } | null;
  setup: SetupState;
  onCreate: (post: ThreadsPost) => void;
  onCreateFromLink: () => void;
  onCreateLinkUrl: (url: string) => void;
  onInspect: (post: ThreadsPost) => void;
  onNavigate: (view: string) => void;
  onOpenLink: (post: ThreadsPost) => void;
  onSave: (post: ThreadsPost) => void;
  onScan: () => void;
  onScanGoal: (goal: ContentGoal) => void;
}) {
  const shortlist = [...posts]
    .filter((post) => analyses[post.id] && analyses[post.id].verdict !== 'skip')
    .sort((a, b) => opportunityPriority(b, analyses[b.id]) - opportunityPriority(a, analyses[a.id]))
    .slice(0, 8);
  const makeNowCount = shortlist.filter((post) => analyses[post.id]?.verdict === 'make_now').length;
  const watchCount = shortlist.filter((post) => analyses[post.id]?.verdict !== 'make_now').length;
  const readyCount = shortlist.filter((post) => Boolean(analyses[post.id]?.videoScript.postReadVersion)).length;

  const setupItems = [
    { ok: setup.apiKey, label: copy.setupOpenAiKey, target: 'settings', optional: false },
    { ok: setup.threadsLogin, label: copy.setupThreads, target: 'settings', optional: false },
    { ok: setup.background, label: copy.setupBackground, target: 'assets', optional: false },
    { ok: setup.keywords, label: copy.setupKeywords, target: 'keywords', optional: true }
  ];
  const setupDone = setupItems.every((item) => item.ok);

  const flowSteps = [
    { step: 1, title: copy.flowStep1Title, description: copy.flowStep1Desc },
    { step: 2, title: copy.flowStep2Title, description: copy.flowStep2Desc },
    { step: 3, title: copy.flowStep3Title, description: copy.flowStep3Desc }
  ];

  return (
    <div className="space-y-4">
      {!setupDone ? (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-base font-semibold text-text">{copy.setupChecklist}</h2>
          <p className="mt-1 text-sm text-muted">{copy.setupChecklistHelp}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {setupItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border bg-panel p-3">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  {item.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : <Circle className="size-4 shrink-0 text-muted" />}
                  <span className={cn('truncate', item.ok ? 'text-muted line-through' : 'text-text')}>{item.label}</span>
                  {item.optional ? <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">{copy.setupOptional}</span> : null}
                </div>
                {!item.ok ? (
                  <Button className="h-8 shrink-0 px-3 text-xs" onClick={() => onNavigate(item.target)}>
                    {copy.setupFix}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {flowSteps.map((item) => (
          <div key={item.step} className="rounded-lg border border-border bg-panel p-4">
            <div className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{item.step}</div>
            <div className="mt-2 text-sm font-semibold text-text">{item.title}</div>
            <div className="mt-1 text-xs leading-5 text-muted">{item.description}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-text">{copy.createFromLinkTitle}</h2>
          <p className="mt-1 text-sm text-muted">{copy.createFromLinkHelp}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={createLinkUrl}
              onChange={(event) => onCreateLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onCreateFromLink();
              }}
              className="pl-9"
              placeholder={copy.manualImportPlaceholder}
            />
          </div>
          <Button variant="primary" icon={<Wand2 className={cn('size-4', isCreatingFromLink && 'animate-pulse')} />} disabled={!createLinkUrl.trim() || isCreatingFromLink} onClick={onCreateFromLink}>
            {isCreatingFromLink ? copy.createFromLinkWorking : copy.createFromLink}
          </Button>
        </div>
        {isCreatingFromLink && createLinkProgress ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span className="truncate">{createLinkProgress.message}</span>
              <span>{createLinkProgress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${createLinkProgress.percent}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text">{copy.todayShortlist}</h2>
            <p className="mt-1 text-sm text-muted">{copy.todayShortlistHelp}</p>
            {scanSummary ? <p className="mt-2 text-xs text-sky-200">{scanSummary.newPosts} {copy.newPosts} · {scanSummary.seenPosts} {copy.seenPosts}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border" title={copy.scanGoalHelp}>
              <button
                className={cn('px-3 py-2 text-xs font-medium transition', scanGoal === 'affiliate' ? 'bg-accent/15 text-accent' : 'bg-panel text-muted hover:text-text')}
                onClick={() => onScanGoal('affiliate')}
              >
                {copy.scanGoalAffiliate}
              </button>
              <button
                className={cn('px-3 py-2 text-xs font-medium transition', scanGoal === 'engagement' ? 'bg-accent/15 text-accent' : 'bg-panel text-muted hover:text-text')}
                onClick={() => onScanGoal('engagement')}
              >
                {copy.scanGoalEngagement}
              </button>
            </div>
            <Button variant="primary" icon={<Radar className={cn('size-4', isScanning && 'animate-spin')} />} disabled={isScanning} onClick={onScan}>
              {isScanning ? copy.scanningOpportunities : copy.scanOpportunities}
            </Button>
          </div>
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
            <div className="mt-1 text-sm text-muted">{setupDone ? copy.noShortlistHelp : copy.setupChecklistHelp}</div>
          </div>
        ) : null}
      </section>

      {shortlist.length || logs.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InboxMetric icon={<Target className="size-4" />} label={copy.makeNow} value={makeNowCount} tone="success" />
          <InboxMetric icon={<Eye className="size-4" />} label={copy.watch} value={watchCount} tone="warning" />
          <InboxMetric icon={<Video className="size-4" />} label={copy.readyToCreate} value={readyCount} />
          <InboxMetric icon={<TrendingUp className="size-4" />} label={copy.trackedResults} value={logs.length} />
        </section>
      ) : null}
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
