'use client';

import { ArrowDown, ArrowUp, CheckCircle2, Clock3, ExternalLink, FolderOpen, Heart, Lightbulb, RotateCcw, ShoppingBag, Target, Trash2, Video, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TranslationCopy } from '@/lib/i18n';
import type { AIAnalysis, AssetLibraryItem, Product, ThreadsPost, TtsProvider, TtsVoice, VideoDraftRequest, VideoDraftVariant } from '@/lib/types';

export function TikTokBriefModal({
  analysis,
  assets,
  copy,
  creativeAiEnabled,
  initialBackgroundPath,
  matchedProduct,
  post,
  segmentSilenceMs,
  ttsProvider,
  ttsSpeed,
  ttsVoice,
  renderProgress,
  renderedVideoPath,
  renderingVideo,
  videoApproved,
  onClose,
  onOpenLink,
  onOpenOutputFolder,
  onSetApproved,
  onRenderVideo
}: {
  analysis: AIAnalysis;
  assets: AssetLibraryItem[];
  copy: TranslationCopy;
  creativeAiEnabled: boolean;
  initialBackgroundPath?: string;
  matchedProduct?: Product;
  post: ThreadsPost;
  segmentSilenceMs: number;
  ttsProvider: TtsProvider;
  ttsSpeed: number;
  ttsVoice: TtsVoice;
  renderProgress?: { percent: number; message: string } | null;
  renderedVideoPath?: string | null;
  renderingVideo: boolean;
  videoApproved: boolean;
  onClose: () => void;
  onOpenLink: () => void;
  onOpenOutputFolder: () => void;
  onSetApproved: (approved: boolean) => void;
  onRenderVideo: (request: Partial<VideoDraftRequest>) => void;
}) {
  const useOriginalPostReadOnly = !creativeAiEnabled;
  const displayedHooks = useOriginalPostReadOnly ? [] : analysis.hooks;
  const displayedCtas = useOriginalPostReadOnly ? [] : analysis.ctas;
  const [replies, setReplies] = useState(topLikedReplies(post));
  const [hookText, setHookText] = useState(useOriginalPostReadOnly ? '' : analysis.hooks[0] || '');
  const [postText, setPostText] = useState(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
  const [transitionLine, setTransitionLine] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.transitionLine);
  const [solutionText, setSolutionText] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.solutionText || analysis.solutionScript);
  const [ctaText, setCtaText] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.ctaText || analysis.ctas[0] || '');
  const [backgroundPath, setBackgroundPath] = useState(initialBackgroundPath ?? assets.find((asset) => asset.type === 'background')?.filePath ?? '');
  const matchedDemoPath = matchedProduct?.demoAssetId ? assets.find((asset) => asset.id === matchedProduct.demoAssetId)?.filePath ?? '' : '';
  const [productClipPath, setProductClipPath] = useState(matchedDemoPath);
  const [variants, setVariants] = useState<VideoDraftVariant[]>([]);
  useEffect(() => {
    setReplies(topLikedReplies(post));
    setHookText(useOriginalPostReadOnly ? '' : analysis.hooks[0] || '');
    setPostText(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
    setTransitionLine(useOriginalPostReadOnly ? '' : analysis.videoScript.transitionLine);
    setSolutionText(useOriginalPostReadOnly ? '' : analysis.videoScript.solutionText || analysis.solutionScript);
    setCtaText(useOriginalPostReadOnly ? '' : analysis.videoScript.ctaText || analysis.ctas[0] || '');
  }, [analysis, post, post.content, useOriginalPostReadOnly]);
  useEffect(() => {
    if (initialBackgroundPath) setBackgroundPath(initialBackgroundPath);
  }, [initialBackgroundPath]);
  const renderRequest = { post, analysis, selectedReplies: replies, hookText, postReadVersion: postText, transitionLine, solutionText, ctaText, backgroundPath: backgroundPath || undefined, productClipPath: productClipPath || undefined, variants: variants.length ? variants : undefined };
  const estimatedDuration = estimateVideoDuration([
    hookText,
    postText,
    ...replies.map((reply) => reply.content),
    transitionLine,
    solutionText,
    ctaText
  ], { provider: ttsProvider, voice: ttsVoice, speed: ttsSpeed, segmentSilenceMs });

  function addVariant() {
    if (useOriginalPostReadOnly) return;
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
              {useOriginalPostReadOnly ? <Badge>Original</Badge> : (
                <>
                  <Badge>{analysis.verdict === 'make_now' ? copy.makeNow : analysis.verdict === 'skip' ? copy.skip : copy.watch}</Badge>
                  <Badge>{copy.affiliateFit} {analysis.affiliateFitScore}</Badge>
                  <Badge>{copy.confidence} {analysis.confidenceScore}</Badge>
                </>
              )}
            </div>
          </div>
          <Button aria-label={copy.close} title={copy.close} className="px-2" icon={<X className="size-4" />} onClick={onClose} />
        </header>

        <div className="space-y-4 p-5">
          <BriefSection icon={<ExternalLink className="size-4" />} title={copy.sourcePost}>
            <p className="whitespace-pre-wrap text-slate-300">{post.content}</p>
            <Button className="mt-3" icon={<ExternalLink className="size-4" />} onClick={onOpenLink}>
              {copy.openLink}
            </Button>
          </BriefSection>

          {creativeAiEnabled ? <>
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
            {displayedHooks.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                {displayedHooks.slice(0, 3).map((hook, index) => (
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
            <List items={displayedCtas} empty={copy.noCtas} />
          </BriefSection>
          </> : null}

          <BriefSection icon={<Video className="size-4" />} title={useOriginalPostReadOnly ? 'Video content' : 'Pre-render Preview'}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-400/20 bg-sky-400/5 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium text-sky-200">
                <Clock3 className="size-4" />
                Thời lượng ước tính: {formatEstimatedDuration(estimatedDuration.seconds)}
              </div>
              <div className="text-xs text-muted">{estimatedDuration.wordCount} từ · post + {replies.length} replies</div>
            </div>
            {!useOriginalPostReadOnly ? <label className="grid gap-2 text-xs text-muted">{copy.hookOpening}<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={hookText} onChange={(event) => setHookText(event.target.value)} /></label> : null}
            <label className="grid gap-2 text-xs text-muted">
              {useOriginalPostReadOnly ? 'Original post' : 'Post read version'}
              <textarea
                readOnly={useOriginalPostReadOnly}
                className={useOriginalPostReadOnly ? 'min-h-32 rounded-md border border-border bg-panelSoft p-3 text-sm leading-6 text-text outline-none' : 'min-h-24 rounded-md border border-border bg-background p-3 text-sm text-text'}
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
              />
            </label>
            <div className="mt-4 text-xs text-muted">Replies sẽ đọc ({replies.length})</div>
            <div className="mt-2 space-y-2">
              {replies.map((reply, index) => (
                <div key={`${reply.id ?? reply.content}-${index}`} className="flex min-w-0 gap-2 overflow-hidden rounded-md border border-border bg-panelSoft p-2">
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-wrap break-words text-sm text-slate-300 [overflow-wrap:anywhere]">{reply.content}</div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted"><Heart className="size-3" />{(reply.likes ?? 0).toLocaleString('vi-VN')} likes</div>
                  </div>
                  <Button className="h-8 shrink-0 px-2" icon={<ArrowUp className="size-3" />} disabled={index === 0} onClick={() => setReplies(moveItem(replies, index, index - 1))} />
                  <Button className="h-8 shrink-0 px-2" icon={<ArrowDown className="size-3" />} disabled={index === replies.length - 1} onClick={() => setReplies(moveItem(replies, index, index + 1))} />
                  <Button className="h-8 shrink-0 px-2" icon={<Trash2 className="size-3" />} onClick={() => setReplies(replies.filter((_, replyIndex) => replyIndex !== index))} />
                </div>
              ))}
            </div>
            {!useOriginalPostReadOnly ? <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-muted">Transition<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={transitionLine} onChange={(event) => setTransitionLine(event.target.value)} /></label>
              <label className="grid gap-2 text-xs text-muted">CTA<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} /></label>
            </div> : null}
            {!useOriginalPostReadOnly ? <label className="mt-3 grid gap-2 text-xs text-muted">Solution - lời giới thiệu sản phẩm tự nhiên<textarea className="min-h-28 rounded-md border border-border bg-background p-3 text-sm text-text" value={solutionText} onChange={(event) => setSolutionText(event.target.value)} /></label> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className={`grid gap-2 text-xs text-muted ${useOriginalPostReadOnly ? 'md:col-span-2' : ''}`}>Background clip<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={backgroundPath} onChange={(event) => setBackgroundPath(event.target.value)}><option value="">Chọn khi render</option>{assets.filter((asset) => asset.type === 'background').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label>
              {!useOriginalPostReadOnly ? <label className="grid gap-2 text-xs text-muted">Product clip (optional)<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={productClipPath} onChange={(event) => setProductClipPath(event.target.value)}><option value="">Không dùng product clip</option>{assets.filter((asset) => asset.type === 'product').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label> : null}
            </div>
          </BriefSection>

          {!useOriginalPostReadOnly ? <BriefSection icon={<Lightbulb className="size-4" />} title={copy.variantsTitle}>
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
          </BriefSection> : null}
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
              <>
                <Button aria-label={copy.openOutputFolder} title={copy.openOutputFolder} className="px-2" icon={<FolderOpen className="size-4" />} onClick={onOpenOutputFolder} />
                {videoApproved ? (
                  <Button className="border-emerald-500/30 text-emerald-200" icon={<RotateCcw className="size-4" />} onClick={() => onSetApproved(false)}>Bỏ kiểm duyệt</Button>
                ) : (
                  <Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300" icon={<CheckCircle2 className="size-4" />} onClick={() => onSetApproved(true)}>ĐÃ KIỂM DUYỆT</Button>
                )}
              </>
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

function topLikedReplies(post: ThreadsPost) {
  return [...post.topReplies]
    .filter((reply) => reply.content.trim())
    .sort((left, right) => (right.likes ?? 0) - (left.likes ?? 0))
    .slice(0, 10)
    .map((reply) => ({
      id: reply.id,
      author: reply.author,
      authorAvatarUrl: reply.authorAvatarUrl,
      likes: reply.likes,
      replies: reply.replies,
      reposts: reply.reposts,
      shares: reply.shares,
      content: reply.content,
      type: 'TOP_LIKED',
      whySelected: 'Top reply by likes'
    }));
}

function estimateVideoDuration(
  segments: string[],
  tts: { provider: TtsProvider; voice: TtsVoice; speed: number; segmentSilenceMs: number }
) {
  const spokenSegments = segments.map((segment) => segment.trim()).filter(Boolean);
  const wordCount = spokenSegments.reduce((total, segment) => total + (segment.match(/\S+/g)?.length ?? 0), 0);
  const baseWordsPerMinute = tts.provider === 'vieneu'
    ? tts.voice === 'Ngoc-Huyen-Clone' ? 255 : 230
    : tts.provider === 'openai' ? 180 : 175;
  const effectiveWordsPerMinute = baseWordsPerMinute * Math.max(tts.speed, 0.1);
  const speechSeconds = wordCount / effectiveWordsPerMinute * 60;
  const transitionSeconds = Math.max(0, spokenSegments.length - 1) * Math.max(tts.segmentSilenceMs, 0) / 1000;
  return { wordCount, seconds: Math.max(1, Math.round(speechSeconds + transitionSeconds)) };
}

function formatEstimatedDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds} giây`;
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
