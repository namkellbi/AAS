'use client';

import { ArrowDown, ArrowUp, ExternalLink, FolderOpen, Lightbulb, ShoppingBag, Target, Trash2, Video, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, AssetLibraryItem, Product, ThreadsPost, VideoDraftRequest, VideoDraftVariant } from '@/lib/types';

export function TikTokBriefModal({
  analysis,
  assets,
  copy,
  initialBackgroundPath,
  matchedProduct,
  post,
  renderProgress,
  renderedVideoPath,
  renderingVideo,
  onClose,
  onOpenLink,
  onOpenOutputFolder,
  onRenderVideo
}: {
  analysis: AIAnalysis;
  assets: AssetLibraryItem[];
  copy: TranslationCopy;
  initialBackgroundPath?: string;
  matchedProduct?: Product;
  post: ThreadsPost;
  renderProgress?: { percent: number; message: string } | null;
  renderedVideoPath?: string | null;
  renderingVideo: boolean;
  onClose: () => void;
  onOpenLink: () => void;
  onOpenOutputFolder: () => void;
  onRenderVideo: (request: Partial<VideoDraftRequest>) => void;
}) {
  const [replies, setReplies] = useState(analysis.bestReplies);
  const [hookText, setHookText] = useState(analysis.hooks[0] || '');
  const [postText, setPostText] = useState(analysis.videoScript.postReadVersion || post.content);
  const [transitionLine, setTransitionLine] = useState(analysis.videoScript.transitionLine);
  const [solutionText, setSolutionText] = useState(analysis.videoScript.solutionText || analysis.solutionScript);
  const [ctaText, setCtaText] = useState(analysis.videoScript.ctaText || analysis.ctas[0] || '');
  const [backgroundPath, setBackgroundPath] = useState(initialBackgroundPath ?? assets.find((asset) => asset.type === 'background')?.filePath ?? '');
  const matchedDemoPath = matchedProduct?.demoAssetId ? assets.find((asset) => asset.id === matchedProduct.demoAssetId)?.filePath ?? '' : '';
  const [productClipPath, setProductClipPath] = useState(matchedDemoPath);
  const [variants, setVariants] = useState<VideoDraftVariant[]>([]);
  useEffect(() => {
    setReplies(analysis.bestReplies);
    setHookText(analysis.hooks[0] || '');
    setPostText(analysis.videoScript.postReadVersion || post.content);
    setTransitionLine(analysis.videoScript.transitionLine);
    setSolutionText(analysis.videoScript.solutionText || analysis.solutionScript);
    setCtaText(analysis.videoScript.ctaText || analysis.ctas[0] || '');
  }, [analysis, post.content]);
  useEffect(() => {
    if (initialBackgroundPath) setBackgroundPath(initialBackgroundPath);
  }, [initialBackgroundPath]);
  const renderRequest = { post, analysis, selectedReplies: replies, hookText, postReadVersion: postText, transitionLine, solutionText, ctaText, backgroundPath: backgroundPath || undefined, productClipPath: productClipPath || undefined, variants: variants.length ? variants : undefined };

  function addVariant() {
    if (variants.length >= 2) return;
    const index = variants.length + 1;
    setVariants([
      ...variants,
      { label: `variant-${index}`, hookText: analysis.hooks[index] ?? '', ctaText: analysis.ctas[index] ?? '' }
    ]);
  }
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

          {matchedProduct ? (
            <BriefSection icon={<ShoppingBag className="size-4" />} title={copy.matchedProduct}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text">{matchedProduct.name}</span>
                <Badge>{matchedProduct.marketplace === 'tiktok_shop' ? 'TikTok Shop' : matchedProduct.marketplace === 'shopee' ? 'Shopee' : 'Other'}</Badge>
                <Badge>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(matchedProduct.price)}</Badge>
                <Badge>{matchedProduct.commissionPercent}%</Badge>
              </div>
              {matchedProduct.affiliateLink ? <div className="mt-2 truncate text-xs text-sky-200">{matchedProduct.affiliateLink}</div> : null}
            </BriefSection>
          ) : null}

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

          <BriefSection icon={<Lightbulb className="size-4" />} title={copy.contentVariants}>
            {analysis.hooks.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                {analysis.hooks.slice(0, 3).map((hook, index) => (
                  <button key={hook} className={`rounded-md border p-3 text-left text-sm transition ${hookText === hook ? 'border-accent bg-accent/10 text-text' : 'border-border bg-panelSoft text-slate-300 hover:border-accent/50'}`} onClick={() => setHookText(hook)}>
                    <span className="mb-2 block text-[11px] font-medium uppercase text-muted">{copy.variant} {index + 1}</span>
                    {hook}
                  </button>
                ))}
              </div>
            ) : <div className="text-muted">{copy.noHooks}</div>}
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

          <BriefSection icon={<Video className="size-4" />} title="Pre-render Preview">
            <label className="grid gap-2 text-xs text-muted">{copy.hookOpening}<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={hookText} onChange={(event) => setHookText(event.target.value)} /></label>
            <label className="grid gap-2 text-xs text-muted">Post read version<textarea className="min-h-24 rounded-md border border-border bg-background p-3 text-sm text-text" value={postText} onChange={(event) => setPostText(event.target.value)} /></label>
            <div className="mt-4 text-xs text-muted">Replies sẽ đọc ({replies.length})</div>
            <div className="mt-2 space-y-2">
              {replies.map((reply, index) => (
                <div key={`${reply.id ?? reply.content}-${index}`} className="flex min-w-0 gap-2 overflow-hidden rounded-md border border-border bg-panelSoft p-2">
                  <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-slate-300 [overflow-wrap:anywhere]">{reply.content}</div>
                  <Button className="h-8 shrink-0 px-2" icon={<ArrowUp className="size-3" />} disabled={index === 0} onClick={() => setReplies(moveItem(replies, index, index - 1))} />
                  <Button className="h-8 shrink-0 px-2" icon={<ArrowDown className="size-3" />} disabled={index === replies.length - 1} onClick={() => setReplies(moveItem(replies, index, index + 1))} />
                  <Button className="h-8 shrink-0 px-2" icon={<Trash2 className="size-3" />} onClick={() => setReplies(replies.filter((_, replyIndex) => replyIndex !== index))} />
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-muted">Transition<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={transitionLine} onChange={(event) => setTransitionLine(event.target.value)} /></label>
              <label className="grid gap-2 text-xs text-muted">CTA<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} /></label>
            </div>
            <label className="mt-3 grid gap-2 text-xs text-muted">Solution - lời giới thiệu sản phẩm tự nhiên<textarea className="min-h-28 rounded-md border border-border bg-background p-3 text-sm text-text" value={solutionText} onChange={(event) => setSolutionText(event.target.value)} /></label>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-muted">Background clip<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={backgroundPath} onChange={(event) => setBackgroundPath(event.target.value)}><option value="">Chọn khi render</option>{assets.filter((asset) => asset.type === 'background').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label>
              <label className="grid gap-2 text-xs text-muted">Product clip (optional)<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={productClipPath} onChange={(event) => setProductClipPath(event.target.value)}><option value="">Không dùng product clip</option>{assets.filter((asset) => asset.type === 'product').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label>
            </div>
          </BriefSection>

          <BriefSection icon={<Lightbulb className="size-4" />} title={copy.variantsTitle}>
            <p className="text-xs text-muted">{copy.variantsHelp}</p>
            <div className="mt-3 space-y-3">
              {variants.map((variant, index) => (
                <div key={index} className="rounded-md border border-border bg-panelSoft p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      className="h-8 w-40 rounded-md border border-border bg-background px-2 text-xs text-text"
                      value={variant.label}
                      onChange={(event) => setVariants(variants.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
                    />
                    <Button className="h-8 px-2" icon={<Trash2 className="size-3" />} onClick={() => setVariants(variants.filter((_, itemIndex) => itemIndex !== index))} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-xs text-muted">{copy.hookOpening}<textarea className="min-h-16 rounded-md border border-border bg-background p-2 text-sm text-text" value={variant.hookText} onChange={(event) => setVariants(variants.map((item, itemIndex) => (itemIndex === index ? { ...item, hookText: event.target.value } : item)))} /></label>
                    <label className="grid gap-2 text-xs text-muted">CTA<textarea className="min-h-16 rounded-md border border-border bg-background p-2 text-sm text-text" value={variant.ctaText} onChange={(event) => setVariants(variants.map((item, itemIndex) => (itemIndex === index ? { ...item, ctaText: event.target.value } : item)))} /></label>
                  </div>
                </div>
              ))}
            </div>
            {variants.length < 2 ? (
              <Button className="mt-3" icon={<Lightbulb className="size-4" />} onClick={addVariant}>
                {copy.addVariant}
              </Button>
            ) : null}
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
            <Button variant="primary" icon={<Video className="size-4" />} disabled={renderingVideo} onClick={() => onRenderVideo(renderRequest)}>
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

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
