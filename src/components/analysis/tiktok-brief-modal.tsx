'use client';

/* eslint-disable @next/next/no-img-element */

import { ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, ClipboardPaste, Clock3, ExternalLink, FolderOpen, Lightbulb, Play, RotateCcw, ShoppingBag, Target, Trash2, Video, X } from 'lucide-react';
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
  const [replyTtsTexts, setReplyTtsTexts] = useState<Record<string, string>>(() => buildReplyTtsTexts(topLikedReplies(post)));
  const [hookText, setHookText] = useState(useOriginalPostReadOnly ? '' : analysis.hooks[0] || '');
  const [postText, setPostText] = useState(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
  const [postTtsText, setPostTtsText] = useState(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
  const [transitionLine, setTransitionLine] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.transitionLine);
  const [solutionText, setSolutionText] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.solutionText || analysis.solutionScript);
  const [ctaText, setCtaText] = useState(useOriginalPostReadOnly ? '' : analysis.videoScript.ctaText || analysis.ctas[0] || '');
  const [backgroundPath, setBackgroundPath] = useState(() => initialBackgroundPath ?? pickRandomBackgroundAsset(assets));
  const selectedBackgroundAsset = assets.find((asset) => asset.type === 'background' && asset.filePath === backgroundPath);
  const matchedDemoPath = matchedProduct?.demoAssetId ? assets.find((asset) => asset.id === matchedProduct.demoAssetId)?.filePath ?? '' : '';
  const [productClipPath, setProductClipPath] = useState(matchedDemoPath);
  const [variants, setVariants] = useState<VideoDraftVariant[]>([]);
  const [normalizingSpeech, setNormalizingSpeech] = useState(false);
  const [speechNormalizationError, setSpeechNormalizationError] = useState('');
  const [deletedReply, setDeletedReply] = useState<{ reply: ReturnType<typeof topLikedReplies>[number]; index: number } | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [importBackup, setImportBackup] = useState<{ postText: string; replyTexts: Record<string, string> } | null>(null);
  useEffect(() => {
    const nextReplies = topLikedReplies(post);
    setReplies(nextReplies);
    setReplyTtsTexts(buildReplyTtsTexts(nextReplies));
    setHookText(useOriginalPostReadOnly ? '' : analysis.hooks[0] || '');
    setPostText(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
    setPostTtsText(useOriginalPostReadOnly ? post.content : analysis.videoScript.postReadVersion || post.content);
    setTransitionLine(useOriginalPostReadOnly ? '' : analysis.videoScript.transitionLine);
    setSolutionText(useOriginalPostReadOnly ? '' : analysis.videoScript.solutionText || analysis.solutionScript);
    setCtaText(useOriginalPostReadOnly ? '' : analysis.videoScript.ctaText || analysis.ctas[0] || '');
    setDeletedReply(null);
    setClipboardMessage(null);
    setImportBackup(null);
  // Reset the draft only when the user opens a different post or changes the
  // creative mode. Depending on the full post/analysis objects resets typed
  // TTS edits whenever a parent render recreates those objects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, useOriginalPostReadOnly]);
  useEffect(() => {
    setBackgroundPath(initialBackgroundPath ?? pickRandomBackgroundAsset(assets));
    setProductClipPath(matchedDemoPath);
  // A resource choice belongs to one draft. Reset it when opening another post,
  // but do not overwrite a manual selection during ordinary parent re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);
  const renderRequest = { post, analysis, selectedReplies: replies, hookText, postReadVersion: postText, postTtsText, replyTtsTexts: replies.map((reply) => replyTtsTexts[replyKey(reply)] || reply.content), speechTextsFinalized: true, transitionLine, solutionText, ctaText, backgroundPath: backgroundPath || undefined, productClipPath, variants: variants.length ? variants : undefined };
  const estimatedDuration = estimateVideoDuration([
    hookText,
    postTtsText,
    ...replies.map((reply) => replyTtsTexts[replyKey(reply)] || reply.content),
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

  async function normalizeSpeechWithAi() {
    const api = window.desktopAPI;
    if (!api || normalizingSpeech) return;
    setNormalizingSpeech(true);
    setSpeechNormalizationError('');
    try {
      const originals = [postText, ...replies.map((reply) => reply.content)];
      const normalized = await api.normalizeSpeech(originals, post.id);
      setPostTtsText(normalized[0] || postText);
      setReplyTtsTexts(Object.fromEntries(replies.map((reply, index) => [replyKey(reply), normalized[index + 1] || reply.content])));
    } catch (error) {
      setSpeechNormalizationError(error instanceof Error ? error.message : String(error));
    } finally {
      setNormalizingSpeech(false);
    }
  }

  function importSpeechEditor(value: string) {
    const sections = parseSpeechEditor(value, replies.length);
    if (!sections) return false;
    setImportBackup({ postText: postTtsText, replyTexts: { ...replyTtsTexts } });
    setPostTtsText(sections[0]);
    setReplyTtsTexts((current) => Object.fromEntries(replies.map((reply, index) => [
      replyKey(reply),
      sections[index + 1] ?? current[replyKey(reply)] ?? reply.content
    ])));
    return true;
  }

  async function copyForChatGpt() {
    const transcript = buildSpeechEditor(postTtsText, replies, replyTtsTexts);
    const prompt = `Chuẩn hóa nội dung sau để TTS đọc tự nhiên. Chỉ trả về văn bản đã chuẩn hóa, giữ nguyên chính xác các nhãn phân đoạn và không thêm giải thích:\n\n${transcript}`;
    try {
      await navigator.clipboard.writeText(prompt);
      setClipboardMessage({ tone: 'success', text: `Đã copy bài viết và ${replies.length} replies cho ChatGPT.` });
    } catch {
      setClipboardMessage({ tone: 'error', text: 'Không thể truy cập clipboard. Hãy cấp quyền clipboard cho ứng dụng.' });
    }
  }

  async function pasteFromChatGpt() {
    try {
      const value = await navigator.clipboard.readText();
      if (!importSpeechEditor(value)) {
        setClipboardMessage({ tone: 'error', text: `Kết quả không hợp lệ. Cần đúng 1 nhãn [[BÀI VIẾT]] và ${replies.length} nhãn [[REPLY N]].` });
        return;
      }
      setClipboardMessage({ tone: 'success', text: `Đã cập nhật ${replies.length + 1} phân đoạn từ clipboard.` });
    } catch {
      setClipboardMessage({ tone: 'error', text: 'Không thể đọc clipboard. Hãy copy câu trả lời từ ChatGPT rồi thử lại.' });
    }
  }

  function undoTranscriptImport() {
    if (!importBackup) return;
    setPostTtsText(importBackup.postText);
    setReplyTtsTexts(importBackup.replyTexts);
    setImportBackup(null);
    setClipboardMessage({ tone: 'success', text: 'Đã hoàn tác lần dán transcript gần nhất.' });
  }

  function deleteReply(index: number) {
    setDeletedReply({ reply: replies[index], index });
    setReplies(replies.filter((_, replyIndex) => replyIndex !== index));
  }

  function undoDeleteReply() {
    if (!deletedReply) return;
    const next = [...replies];
    next.splice(Math.min(deletedReply.index, next.length), 0, deletedReply.reply);
    setReplies(next);
    setDeletedReply(null);
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
            <details>
              <summary className="cursor-pointer select-none text-slate-300">Xem nội dung bài viết gốc</summary>
              <p className="mt-3 whitespace-pre-wrap text-slate-300">{post.content}</p>
            </details>
            <Button className="mt-3" icon={<ExternalLink className="size-4" />} onClick={onOpenLink}>{copy.openLink}</Button>
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted">Chỉnh toàn bộ lời đọc trong một editor. Các tiêu đề phân đoạn được giữ cố định để render đúng thứ tự.</div>
              <Button className="h-9" icon={<Lightbulb className="size-4" />} disabled={normalizingSpeech} onClick={normalizeSpeechWithAi}>
                {normalizingSpeech ? 'Đang chuẩn hóa...' : 'Chuẩn hóa tất cả bằng AI'}
              </Button>
            </div>
            {speechNormalizationError ? <div className="mt-2 text-xs text-red-300">{speechNormalizationError}</div> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button icon={<ClipboardCopy className="size-4" />} onClick={() => void copyForChatGpt()}>Copy cho ChatGPT</Button>
              <Button icon={<ClipboardPaste className="size-4" />} onClick={() => void pasteFromChatGpt()}>Dán kết quả</Button>
              <span className="text-xs text-muted">Copy → sửa trong ChatGPT → copy câu trả lời → dán kết quả</span>
            </div>
            {clipboardMessage ? (
              <div className={`mt-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${clipboardMessage.tone === 'success' ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100' : 'border-rose-400/20 bg-rose-400/5 text-rose-100'}`}>
                <span>{clipboardMessage.text}</span>
                {importBackup ? <button className="shrink-0 font-semibold text-sky-300 hover:text-sky-200" onClick={undoTranscriptImport}>Hoàn tác lần dán</button> : null}
              </div>
            ) : null}
            <div
              className="mt-3 overflow-hidden rounded-md border border-border bg-background focus-within:border-accent"
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text/plain');
                if (!pasted.includes('[[BÀI VIẾT]]') || !importSpeechEditor(pasted)) return;
                event.preventDefault();
                setClipboardMessage({ tone: 'success', text: `Đã cập nhật ${replies.length + 1} phân đoạn từ clipboard.` });
              }}
            >
              <section className="group px-4 py-3">
                <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-300">Bài viết</div>
                  {postTtsText.trim() !== postText.trim() ? <Button className="h-8 px-2 text-xs opacity-70 transition group-hover:opacity-100" onClick={() => setPostTtsText(postText)}>Khôi phục</Button> : null}
                </div>
                <div
                  role="textbox"
                  aria-label="Nội dung đọc của bài viết"
                  aria-multiline="true"
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-20 whitespace-pre-wrap text-sm leading-6 text-text outline-none"
                  onInput={(event) => setPostTtsText(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
                >{postTtsText}</div>
              </section>
              {replies.map((reply, index) => (
                <section key={replyKey(reply)} className="group border-t border-border px-4 py-3 focus-within:bg-white/[0.02] hover:bg-white/[0.02]">
                  <div className="mb-2 flex min-h-8 items-center gap-2">
                    <div className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Reply {index + 1} <span className="normal-case tracking-normal">· {(reply.likes ?? 0).toLocaleString('vi-VN')} likes{reply.author ? ` · ${reply.author}` : ''}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      {(replyTtsTexts[replyKey(reply)] || reply.content).trim() !== reply.content.trim() ? <button className="px-1 text-[11px] text-sky-300 hover:text-sky-200" onClick={() => setReplyTtsTexts((current) => ({ ...current, [replyKey(reply)]: reply.content }))}>Khôi phục</button> : null}
                      <Button aria-label={`Đưa reply ${index + 1} lên`} title="Đưa lên" className="h-8 px-2" icon={<ArrowUp className="size-3" />} disabled={index === 0} onClick={() => setReplies(moveItem(replies, index, index - 1))} />
                      <Button aria-label={`Đưa reply ${index + 1} xuống`} title="Đưa xuống" className="h-8 px-2" icon={<ArrowDown className="size-3" />} disabled={index === replies.length - 1} onClick={() => setReplies(moveItem(replies, index, index + 1))} />
                      <Button aria-label={`Xóa reply ${index + 1}`} title="Xóa reply" className="h-8 px-2 text-rose-300 hover:text-rose-200" icon={<Trash2 className="size-3" />} onClick={() => deleteReply(index)} />
                    </div>
                  </div>
                  <div
                    role="textbox"
                    aria-label={`Nội dung đọc của reply ${index + 1}`}
                    aria-multiline="true"
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-12 whitespace-pre-wrap text-sm leading-6 text-text outline-none"
                    onInput={(event) => setReplyTtsTexts((current) => ({ ...current, [replyKey(reply)]: event.currentTarget.innerText.replace(/\r\n/g, '\n') }))}
                  >{replyTtsTexts[replyKey(reply)] ?? reply.content}</div>
                </section>
              ))}
            </div>
            {deletedReply ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                <span className="min-w-0 truncate">Đã xóa: {deletedReply.reply.content}</span>
                <button className="shrink-0 font-semibold text-sky-300 hover:text-sky-200" onClick={undoDeleteReply}>Hoàn tác</button>
              </div>
            ) : null}
            {!useOriginalPostReadOnly ? <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-muted">Transition<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={transitionLine} onChange={(event) => setTransitionLine(event.target.value)} /></label>
              <label className="grid gap-2 text-xs text-muted">CTA<textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm text-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} /></label>
            </div> : null}
            {!useOriginalPostReadOnly ? <label className="mt-3 grid gap-2 text-xs text-muted">Solution - lời giới thiệu sản phẩm tự nhiên<textarea className="min-h-28 rounded-md border border-border bg-background p-3 text-sm text-text" value={solutionText} onChange={(event) => setSolutionText(event.target.value)} /></label> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className={`grid gap-2 text-xs text-muted ${useOriginalPostReadOnly ? 'md:col-span-2' : ''}`}>Background clip<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={backgroundPath} onChange={(event) => setBackgroundPath(event.target.value)}><option value="">Chọn khi render</option>{assets.filter((asset) => asset.type === 'background').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label>
              {!useOriginalPostReadOnly ? <label className="grid gap-2 text-xs text-muted">Product clip (optional)<select className="h-10 rounded-md border border-border bg-background px-3 text-sm text-text" value={productClipPath} onChange={(event) => setProductClipPath(event.target.value)}><option value="">Không dùng product clip</option>{assets.filter((asset) => asset.type === 'product').map((asset) => <option key={asset.id} value={asset.filePath}>{asset.label}</option>)}</select></label> : null}
            </div>
            {selectedBackgroundAsset ? (
              <div className="mt-3 flex items-center gap-3 overflow-hidden rounded-md border border-border bg-panelSoft p-2.5">
                <button
                  type="button"
                  className="group relative h-20 w-32 shrink-0 overflow-hidden rounded bg-background"
                  title={`Preview ${selectedBackgroundAsset.label}`}
                  onClick={() => void window.desktopAPI?.openAssetPreview(selectedBackgroundAsset.id)}
                >
                  {selectedBackgroundAsset.thumbnailDataUrl ? (
                    <img src={selectedBackgroundAsset.thumbnailDataUrl} alt="" className="size-full object-cover transition duration-200 group-hover:scale-105" />
                  ) : (
                    <div className="grid size-full place-items-center text-[11px] text-muted">Chưa có thumbnail</div>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/35">
                    <span className="grid size-9 place-items-center rounded-full bg-black/70 text-white"><Play className="ml-0.5 size-4" /></span>
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text" title={selectedBackgroundAsset.label}>{selectedBackgroundAsset.label}</div>
                  <div className="mt-1 text-xs text-muted">{selectedBackgroundAsset.durationSecs.toFixed(1)} giây · đã dùng {selectedBackgroundAsset.timesUsed} lần</div>
                  <Button className="mt-2 h-8 px-2 text-xs" icon={<Play className="size-3.5" />} onClick={() => void window.desktopAPI?.openAssetPreview(selectedBackgroundAsset.id)}>
                    Xem preview
                  </Button>
                </div>
              </div>
            ) : null}
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

function pickRandomBackgroundAsset(assets: AssetLibraryItem[]) {
  const backgrounds = assets.filter((asset) => asset.type === 'background');
  return backgrounds[Math.floor(Math.random() * backgrounds.length)]?.filePath ?? '';
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
      mediaUrls: reply.mediaUrls,
      likes: reply.likes,
      replies: reply.replies,
      reposts: reply.reposts,
      shares: reply.shares,
      content: reply.content,
      type: 'TOP_LIKED',
      whySelected: 'Top reply by likes'
    }));
}

function replyKey(reply: { id?: string; author?: string; content: string }) {
  return reply.id || `${reply.author ?? ''}:${reply.content}`;
}

function buildReplyTtsTexts(replies: Array<{ id?: string; author?: string; content: string }>) {
  return Object.fromEntries(replies.map((reply) => [replyKey(reply), reply.content]));
}

const SPEECH_SECTION_PATTERN = /^\[\[(?:BÀI VIẾT|REPLY \d+)\]\]$/gm;

function buildSpeechEditor(
  postText: string,
  replies: Array<{ id?: string; author?: string; content: string }>,
  replyTexts: Record<string, string>
) {
  return [
    `[[BÀI VIẾT]]\n${postText}`,
    ...replies.map((reply, index) => `[[REPLY ${index + 1}]]\n${replyTexts[replyKey(reply)] ?? reply.content}`)
  ].join('\n\n');
}

function parseSpeechEditor(value: string, replyCount: number) {
  const firstMarker = value.indexOf('[[BÀI VIẾT]]');
  if (firstMarker < 0) return null;
  const transcript = value.slice(firstMarker).replace(/\n?```\s*$/, '').trim();
  const markers = [...transcript.matchAll(SPEECH_SECTION_PATTERN)];
  if (markers.length !== replyCount + 1 || markers[0]?.index !== 0) return null;
  return markers.map((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? transcript.length;
    return transcript.slice(start, end).replace(/^\n/, '').replace(/\n\n$/, '');
  });
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
