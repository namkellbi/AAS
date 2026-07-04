'use client';

import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Lightbulb, MessageCircle, ShoppingBag, Sparkles, Target, TrendingUp, Users, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScoreRing } from '@/components/ui/score-ring';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';

export function AnalysisPanel({
  post,
  analysis,
  copy
}: {
  post?: ThreadsPost;
  analysis?: AIAnalysis | null;
  copy: TranslationCopy;
}) {
  const [showTechnicalScores, setShowTechnicalScores] = useState(false);
  if (!post) {
    return (
      <aside className="h-screen w-[390px] shrink-0 border-l border-border bg-[#0c0f13] p-5">
        <div className="rounded-lg border border-border bg-panel p-5 text-sm text-muted">{copy.selectPostPrompt}</div>
      </aside>
    );
  }

  return (
    <aside className="h-screen w-[390px] shrink-0 overflow-y-auto border-l border-border bg-[#0c0f13] p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>{post.emotionalCategory}</Badge>
            <Badge>{analysis?.buyingIntent ?? copy.intentPending}</Badge>
            {analysis ? <Badge>{analysis.verdict === 'make_now' ? copy.makeNow : analysis.verdict === 'skip' ? copy.skip : copy.watch}</Badge> : null}
          </div>
          <h2 className="text-lg font-semibold text-text">{copy.aiAnalysis}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" />{post.replies} replies</span>
            <span className="inline-flex items-center gap-1"><TrendingUp className="size-3.5" />{trendLabel(post.trendState)}</span>
          </div>
        </div>
        <ScoreRing value={post.opportunityScore} label={copy.opportunityScore} />
      </div>

      <section className="space-y-4">
        <PanelBlock icon={<Target className="size-4" />} title={copy.whyViral}>
          {analysis?.whyViral ?? copy.analysisPending}
        </PanelBlock>

        <PanelBlock icon={<Sparkles className="size-4" />} title={copy.emotionalTrigger}>
          <div className="text-text">{analysis?.emotion ?? post.emotionalCategory}</div>
          <div className="mt-2 text-muted">{analysis?.painPoint ?? copy.painPointPending}</div>
        </PanelBlock>

        <PanelBlock icon={<ShoppingBag className="size-4" />} title={copy.affiliateOpportunities}>
          <PillList items={analysis?.affiliateCategories ?? []} empty={copy.noCategories} />
          <div className="mt-3 space-y-2">
            {(analysis?.affiliateProducts ?? []).map((product) => (
              <div key={product} className="rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-text">
                {product}
              </div>
            ))}
          </div>
        </PanelBlock>

        {analysis?.personas.length ? (
          <PanelBlock icon={<Users className="size-4" />} title={copy.personas}>
            <PillList items={analysis.personas} empty={copy.noAffiliateFit} />
          </PanelBlock>
        ) : null}

        {analysis?.situations.length ? (
          <PanelBlock icon={<Target className="size-4" />} title={copy.situations}>
            <PillList items={analysis.situations} empty={copy.noAffiliateFit} />
          </PanelBlock>
        ) : null}

        {analysis?.demoAngle || analysis?.contentFormat ? (
          <PanelBlock icon={<Video className="size-4" />} title={copy.demoAngle}>
            <div>{analysis.demoAngle}</div>
            {analysis.contentFormat ? <div className="mt-3 border-t border-border pt-3 text-muted"><span className="text-text">{copy.contentFormat}:</span> {analysis.contentFormat}</div> : null}
          </PanelBlock>
        ) : null}

        {analysis?.rejectReason ? (
          <PanelBlock icon={<AlertTriangle className="size-4" />} title={copy.rejectReason}>
            {analysis.rejectReason}
          </PanelBlock>
        ) : null}

        <PanelBlock icon={<Lightbulb className="size-4" />} title={copy.hooks}>
          <PillList items={analysis?.hooks ?? []} empty={copy.noHooks} />
        </PanelBlock>

        <PanelBlock icon={<ExternalLink className="size-4" />} title={copy.ctaSuggestions}>
          <PillList items={analysis?.ctas ?? []} empty={copy.noCtas} />
        </PanelBlock>

        <button className="flex w-full items-center justify-between rounded-lg border border-border bg-panel px-4 py-3 text-left text-sm font-semibold text-text transition hover:border-accent/50" onClick={() => setShowTechnicalScores((current) => !current)}>
          <span>Chi tiết điểm số</span>
          {showTechnicalScores ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {showTechnicalScores ? (
          <div className="grid grid-cols-2 gap-3">
            <Metric label={copy.viralScore} value={post.trendingScore} />
            <Metric label={copy.affiliateFit} value={analysis?.affiliateFitScore ?? post.affiliateFitScore} />
            <Metric label={copy.opportunityScore} value={post.opportunityScore} />
            <Metric label={copy.relatability} value={analysis?.relatabilityScore ?? estimateRelatability(post.trendingScore)} />
            <Metric label={copy.controversy} value={analysis?.controversyScore ?? 0} />
            <Metric label={copy.growth} value={post.engagementGrowthPercent} />
            <Metric label={copy.confidence} value={analysis?.confidenceScore ?? 0} />
            <Metric label="Video potential" value={analysis?.videoPotentialScore ?? post.videoPotentialScore} />
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function trendLabel(state: ThreadsPost['trendState']) {
  return { EMERGING: 'Đang nổi lên', GROWING: 'Đang tăng nhanh', PEAK: 'Đang đạt đỉnh', DECLINING: 'Đang giảm', DEAD: 'Đã nguội' }[state];
}

function PanelBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
        {icon}
        {title}
      </div>
      <div className="text-sm leading-6 text-slate-300">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-text">{value}</div>
    </div>
  );
}

function PillList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <div className="text-muted">{empty}</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} className="h-auto min-h-7 whitespace-normal py-1 text-slate-200">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function estimateRelatability(score: number) {
  return Math.min(95, Math.max(45, score + 8));
}
