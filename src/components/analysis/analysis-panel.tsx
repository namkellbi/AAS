'use client';

import { ExternalLink, Lightbulb, ShoppingBag, Sparkles, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/ui/score-ring';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';

export function AnalysisPanel({
  post,
  analysis,
  loading,
  onAnalyze,
  copy
}: {
  post?: ThreadsPost;
  analysis?: AIAnalysis | null;
  loading: boolean;
  onAnalyze: () => void;
  copy: TranslationCopy;
}) {
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
          </div>
          <h2 className="text-lg font-semibold text-text">{copy.aiAnalysis}</h2>
        </div>
        <ScoreRing value={post.trendingScore} />
      </div>

      <Button className="mb-5 w-full" variant="primary" icon={<Sparkles className="size-4" />} disabled={loading} onClick={onAnalyze}>
        {loading ? copy.analyzing : copy.analyzePost}
      </Button>

      <section className="space-y-4">
        <PanelBlock icon={<Target className="size-4" />} title={copy.whyViral}>
          {analysis?.whyViral ?? copy.analysisPending}
        </PanelBlock>

        <div className="grid grid-cols-2 gap-3">
          <Metric label={copy.relatability} value={analysis?.relatabilityScore ?? estimateRelatability(post.trendingScore)} />
          <Metric label={copy.controversy} value={analysis?.controversyScore ?? 0} />
        </div>

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

        <PanelBlock icon={<Lightbulb className="size-4" />} title={copy.hooks}>
          <PillList items={analysis?.hooks ?? []} empty={copy.noHooks} />
        </PanelBlock>

        <PanelBlock icon={<ExternalLink className="size-4" />} title={copy.ctaSuggestions}>
          <PillList items={analysis?.ctas ?? []} empty={copy.noCtas} />
        </PanelBlock>
      </section>
    </aside>
  );
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
      <div className="mt-1 text-2xl font-semibold text-text">{value}</div>
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
