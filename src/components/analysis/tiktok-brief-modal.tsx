'use client';

import { Clipboard, ExternalLink, FolderOpen, Lightbulb, ShoppingBag, Target, Video, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';

export function TikTokBriefModal({
  analysis,
  copied,
  copy,
  post,
  renderProgress,
  renderedVideoPath,
  renderingVideo,
  onClose,
  onCopy,
  onOpenLink,
  onOpenOutputFolder,
  onRenderVideo
}: {
  analysis: AIAnalysis;
  copied: boolean;
  copy: TranslationCopy;
  post: ThreadsPost;
  renderProgress?: { percent: number; message: string } | null;
  renderedVideoPath?: string | null;
  renderingVideo: boolean;
  onClose: () => void;
  onCopy: () => void;
  onOpenLink: () => void;
  onOpenOutputFolder: () => void;
  onRenderVideo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onMouseDown={onClose}>
      <section
        aria-label={copy.tiktokBrief}
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-[#0c0f13] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-[#0c0f13]/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-accent">TikTok / Reels</div>
            <h2 className="mt-1 text-lg font-semibold text-text">{copy.tiktokBrief}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{analysis.verdict === 'make_now' ? copy.makeNow : analysis.verdict === 'skip' ? copy.skip : copy.watch}</Badge>
              <Badge>{copy.affiliateFit} {analysis.affiliateFitScore}</Badge>
              <Badge>{copy.confidence} {analysis.confidenceScore}</Badge>
            </div>
          </div>
          <Button aria-label={copy.close} title={copy.close} className="px-2" icon={<X className="size-4" />} onClick={onClose} />
        </header>

        <div className="space-y-4 p-5">
          <BriefSection icon={<ExternalLink className="size-4" />} title={copy.sourcePost}>
            <p className="line-clamp-3 text-slate-300">{post.content}</p>
            <Button className="mt-3" icon={<ExternalLink className="size-4" />} onClick={onOpenLink}>
              {copy.openLink}
            </Button>
          </BriefSection>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefSection icon={<Target className="size-4" />} title={copy.emotionalTrigger}>
              <div className="font-medium text-text">{analysis.emotion}</div>
              <p className="mt-2 text-slate-300">{analysis.painPoint}</p>
            </BriefSection>
            <BriefSection icon={<ShoppingBag className="size-4" />} title={copy.affiliateOpportunities}>
              <List items={analysis.affiliateProducts} empty={copy.noCategories} />
            </BriefSection>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefSection icon={<Target className="size-4" />} title={copy.personas}>
              <List items={analysis.personas} empty={copy.noAffiliateFit} />
            </BriefSection>
            <BriefSection icon={<ShoppingBag className="size-4" />} title={copy.productSearchKeywords}>
              <Pills items={analysis.productSearchKeywords} empty={copy.noCategories} />
            </BriefSection>
          </div>

          <BriefSection icon={<Lightbulb className="size-4" />} title={copy.hooks}>
            <List items={analysis.hooks} empty={copy.noHooks} />
          </BriefSection>

          <BriefSection icon={<Video className="size-4" />} title={copy.scriptOutline}>
            <List items={analysis.scriptOutline.length ? analysis.scriptOutline : [analysis.contentFormat].filter(Boolean)} empty={copy.noAffiliateFit} />
          </BriefSection>

          <BriefSection icon={<Video className="size-4" />} title={copy.demoAngle}>
            <p className="text-slate-300">{analysis.demoAngle || copy.noAffiliateFit}</p>
          </BriefSection>

          <BriefSection icon={<ExternalLink className="size-4" />} title={copy.ctaSuggestions}>
            <List items={analysis.ctas} empty={copy.noCtas} />
          </BriefSection>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-[#0c0f13]/95 px-5 py-4 backdrop-blur">
          <div className="max-w-md space-y-2 text-xs leading-5 text-muted">
            <div>{copy.videoDraftHelp}</div>
            <div className="text-slate-300">{copy.videoDraftFilePickerHelp}</div>
            {renderProgress ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-slate-200">
                  <span>{renderProgress.message}</span>
                  <span>{renderProgress.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${renderProgress.percent}%` }} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose}>{copy.close}</Button>
            <Button icon={<Clipboard className="size-4" />} onClick={onCopy}>
              {copied ? copy.briefCopied : copy.copyBrief}
            </Button>
            <Button variant="primary" icon={<Video className="size-4" />} disabled={renderingVideo} onClick={onRenderVideo}>
              {renderingVideo ? copy.renderingVideoDraft : copy.createVideoDraft}
            </Button>
            {renderedVideoPath ? (
              <Button aria-label={copy.openOutputFolder} title={copy.openOutputFolder} className="px-2" icon={<FolderOpen className="size-4" />} onClick={onOpenOutputFolder} />
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function formatTikTokBrief(post: ThreadsPost, analysis: AIAnalysis, copy: TranslationCopy) {
  return [
    copy.tiktokBrief,
    '',
    `${copy.sourcePost}: ${post.url}`,
    post.content,
    '',
    `${copy.emotionalTrigger}: ${analysis.emotion}`,
    `${copy.painPoint}: ${analysis.painPoint}`,
    `${copy.personas}: ${analysis.personas.join('; ')}`,
    `${copy.affiliateOpportunities}: ${analysis.affiliateProducts.join('; ')}`,
    `${copy.productSearchKeywords}: ${analysis.productSearchKeywords.join('; ')}`,
    `${copy.hooks}: ${analysis.hooks.join('; ')}`,
    `${copy.scriptOutline}:`,
    ...analysis.scriptOutline.map((item) => `- ${item}`),
    `${copy.demoAngle}: ${analysis.demoAngle}`,
    `${copy.ctaSuggestions}: ${analysis.ctas.join('; ')}`
  ].join('\n');
}

function BriefSection({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
        {icon}
        {title}
      </div>
      <div className="text-sm leading-6">{children}</div>
    </section>
  );
}

function List({ empty, items }: { empty: string; items: string[] }) {
  if (!items.length) return <div className="text-muted">{empty}</div>;
  return (
    <ul className="space-y-2 text-slate-300">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-border bg-panelSoft px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Pills({ empty, items }: { empty: string; items: string[] }) {
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
