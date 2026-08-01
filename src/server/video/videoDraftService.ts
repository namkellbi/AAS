import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { normalizeVietnameseForSpeech } from '@/lib/vietnamese-speech';
import { getTtsModel } from '@/lib/tts';
import type { AIAnalysis, Product, SelectedReply, ThreadsPost, TtsProvider, TtsSegmentKind, TtsVoice, VideoDraftProgress, VideoDraftResult, VideoDraftVariant } from '@/lib/types';
import { getCreativeAiEnabled, getDefaultSpeed, getDefaultVoice, getGeminiApiKey, getKaraokeCaptionsEnabled, getOpenAiApiKey, getSegmentSilenceMs, getSetting, getTtsInstruction, getTtsProvider, setSetting } from '@/server/db/client';
import { scrapeThreadsPostReplies } from '@/server/scraper/threadsScraper';
import { buildKaraokeAss, ensureSubtitlesFilterAvailable, subtitlesFilterArg } from '@/server/video/subtitleService';
import { normalizeVietnameseSpeechBatch } from '@/server/video/speechNormalizationService';
import { getWordTimestamps } from '@/server/video/transcriptionService';
import { synthesizeSpeech } from '@/server/video/ttsService';
import { withRetry } from '@/server/utils/withRetry';

type RenderVideoDraftRequest = {
  backgroundPath: string;
  demoPath?: string;
  post: ThreadsPost;
  analysis: AIAnalysis;
  selectedReplies?: SelectedReply[];
  hookText?: string;
  postReadVersion?: string;
  transitionLine?: string;
  solutionText?: string;
  ctaText?: string;
  product?: Product;
  variants?: VideoDraftVariant[];
};

type Scene = {
  audioPath: string;
  duration: number;
  imagePath?: string;
  outputPath: string;
  assPath?: string;
  speechText: string;
};

type TextSceneStyle = 'card' | 'native-hook' | 'none';

const backgroundMusicPath = () => path.resolve(process.cwd(), 'data', 'background-music', 'cute.mp3');
const backgroundMusicVolume = 0.10;

// D4 — template rotation: vary card palette and hook style between renders
// so consecutive videos do not look machine-stamped. State persists in app_settings.
const cardThemes: Record<string, { transition: string; solution: string; product: string; outro: string }> = {
  classic: { transition: '#fbbf24', solution: '#22c55e', product: '#22c55e', outro: '#38bdf8' },
  sunset: { transition: '#fb923c', solution: '#34d399', product: '#34d399', outro: '#a78bfa' },
  candy: { transition: '#f472b6', solution: '#4ade80', product: '#4ade80', outro: '#22d3ee' }
};
type HookStyle = 'pill' | 'outline' | 'boxed';
const hookStyles: HookStyle[] = ['pill', 'outline', 'boxed'];

let activeCardTheme = cardThemes.classic;
let activeHookStyle: HookStyle = 'pill';
let activePostId: string | undefined;

function pickTemplateRotation() {
  const state = safeJsonParse<{ lastCardTheme?: string; lastHookStyle?: string }>(getSetting('video.template_rotation_state') ?? '{}');
  const themeKey = pickDifferent(Object.keys(cardThemes), state.lastCardTheme);
  const hookStyle = pickDifferent(hookStyles, state.lastHookStyle) as HookStyle;
  activeCardTheme = cardThemes[themeKey];
  activeHookStyle = hookStyle;
  setSetting('video.template_rotation_state', JSON.stringify({ lastCardTheme: themeKey, lastHookStyle: hookStyle }));
}

function pickDifferent(options: readonly string[], last?: string): string {
  const pool = options.filter((option) => option !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? options[0];
}

function safeJsonParse<T>(value: string): Partial<T> {
  try {
    return JSON.parse(value) as Partial<T>;
  } catch {
    return {};
  }
}

export async function renderVideoDraft(request: RenderVideoDraftRequest, onProgress: (progress: VideoDraftProgress) => void = () => {}): Promise<VideoDraftResult> {
  const openAiApiKey = getOpenAiApiKey();
  const ttsProvider = getTtsProvider();
  const apiKey = ttsProvider === 'gemini'
    ? getGeminiApiKey()
    : ttsProvider === 'vieneu'
      ? ''
      : openAiApiKey;
  if (ttsProvider !== 'vieneu' && !apiKey) {
    throw new Error(`${ttsProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API key is missing. Add it in Settings before generating a video voiceover.`);
  }
  if (!request.backgroundPath || !fs.existsSync(request.backgroundPath)) throw new Error('Background clip is missing. Select a valid clip from Asset Library before rendering.');
  const useOriginalPostReadOnly = !getCreativeAiEnabled();
  const karaokeEnabled = getKaraokeCaptionsEnabled();
  if (karaokeEnabled && !openAiApiKey) throw new Error('OpenAI API key is required for Whisper karaoke timestamps. Add the key or turn off Karaoke caption.');
  if (karaokeEnabled) await ensureSubtitlesFilterAvailable();

  const { exportDir, exportName } = allocateExportDirectory();
  const workDir = path.join(exportDir, '_work');
  const thumbDir = path.join(workDir, 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, 'export-info.json'), JSON.stringify({ postId: request.post.id, createdAt: new Date().toISOString() }, null, 2), 'utf8');
  const outputPath = path.join(exportDir, `${exportName}.mp4`);
  const voice = getDefaultVoice();
  const speed = getDefaultSpeed();
  const hookText = useOriginalPostReadOnly ? '' : request.hookText?.trim() || request.analysis.hooks[0]?.trim() || '';
  const postText = useOriginalPostReadOnly ? request.post.content : request.postReadVersion?.trim() || request.analysis.videoScript.postReadVersion.trim() || request.post.content;
  let replies = (request.selectedReplies ?? request.analysis.bestReplies).filter((reply) => reply.content.trim()).slice(0, 10);
  if (replies.some((reply) => !reply.authorAvatarUrl) && request.post.url) {
    onProgress({ percent: 7, message: 'Đang bổ sung avatar và reaction cho replies...' });
    const refreshed = await scrapeThreadsPostReplies(request.post.url).catch(() => []);
    replies = replies.map((reply) => {
      const source = refreshed.find((candidate) => candidate.id === reply.id)
        ?? refreshed.find((candidate) => candidate.content.trim() === reply.content.trim());
      return source ? {
        ...reply,
        author: source.author,
        authorAvatarUrl: source.authorAvatarUrl,
        likes: source.likes,
        replies: source.replies,
        reposts: source.reposts,
        shares: source.shares
      } : reply;
    });
  }
  const transitionLine = useOriginalPostReadOnly ? '' : request.transitionLine?.trim() || request.analysis.videoScript.transitionLine.trim() || 'Nhưng có một món nhỏ xử lý gọn lắm.';
  const solutionText = useOriginalPostReadOnly ? '' : request.solutionText?.trim() || request.analysis.videoScript.solutionText?.trim() || request.analysis.solutionScript.trim() || 'Thử dùng món này xem sao nha. Nhỏ gọn, dễ dùng và có thể demo trực tiếp trong video.';
  const ctaText = useOriginalPostReadOnly ? '' : request.ctaText?.trim() || request.analysis.videoScript.ctaText.trim() || request.analysis.ctas[0] || 'Thử tham khảo nếu bạn cũng gặp tình trạng này nhé.';

  const silenceSecs = getSegmentSilenceMs() / 1000;
  activePostId = request.post.id;
  pickTemplateRotation();
  const ttsFor = (kind: TtsSegmentKind) => getTtsInstruction(kind);
  const speechSources = [hookText, postText, ...replies.map((reply) => reply.content), transitionLine, solutionText, ctaText].filter(Boolean);
  onProgress({ percent: 12, message: 'Đang chuẩn hóa tiếng lóng và cách đọc tiếng Việt...' });
  const normalizedSpeech = await normalizeVietnameseSpeechBatch(
    speechSources,
    openAiApiKey,
    request.post.id
  );
  const speechBySource = new Map(speechSources.map((source, index) => [source, normalizedSpeech[index]]));
  const spokenText = (source: string) => speechBySource.get(source) ?? normalizeVietnameseForSpeech(source);

  onProgress({ percent: 16, message: `Đang tạo voiceover · ${voice} · tốc độ ${speed.toFixed(2)}x...` });
  const hookScene = hookText ? await createTextScene(workDir, 'hook', hookText, apiKey, voice, speed, 2, ttsFor('hook'), karaokeEnabled ? 'native-hook' : 'card', spokenText(hookText)) : null;
  const postScene = await createSpokenScene(workDir, 'post', postText, request.post, undefined, apiKey, voice, speed, ttsFor('post'), spokenText(postText));
  const replyScenes = await Promise.all(
    replies.map((reply, index) => createSpokenScene(workDir, `reply-${index + 1}`, reply.content, request.post, reply, apiKey, voice, speed, ttsFor('reply'), spokenText(reply.content)))
  );
  const transitionScene = transitionLine ? await createTextScene(workDir, 'transition', transitionLine, apiKey, voice, speed, 2, ttsFor('transition'), karaokeEnabled ? 'none' : 'card', spokenText(transitionLine)) : null;
  const solutionScene = solutionText ? await createTextScene(workDir, 'solution', solutionText, apiKey, voice, speed, 4, ttsFor('solution'), karaokeEnabled ? 'none' : 'card', spokenText(solutionText)) : null;
  const outroScene = ctaText ? await createTextScene(workDir, 'outro', ctaText, apiKey, voice, speed, 3, ttsFor('cta'), karaokeEnabled ? 'none' : 'card', spokenText(ctaText)) : null;

  const scenes = [hookScene, postScene, ...replyScenes, transitionScene, solutionScene].filter((scene): scene is Scene => Boolean(scene));

  if (karaokeEnabled) {
    onProgress({ percent: 42, message: 'Đang tạo phụ đề karaoke...' });
    for (const scene of [postScene, ...replyScenes, transitionScene, solutionScene, outroScene].filter((scene): scene is Scene => Boolean(scene))) {
      const { words } = await getWordTimestamps(scene.audioPath, openAiApiKey, request.post.id, scene.speechText);
      if (!words.length) continue;
      const assPath = scene.audioPath.replace(/\.mp3$/i, '.ass');
      fs.writeFileSync(assPath, buildKaraokeAss(words), 'utf8');
      scene.assPath = assPath;
    }
  }
  onProgress({ percent: 48, message: 'Đang render từng segment độc lập...' });
  for (let index = 0; index < scenes.length; index += 1) {
    const isPostBeforeReplies = scenes[index] === postScene && replyScenes.length > 0;
    await renderOverlayScene(request.backgroundPath, scenes[index], isPostBeforeReplies ? Math.max(silenceSecs, 0.3) : silenceSecs);
    onProgress({ percent: 48 + Math.round(((index + 1) / Math.max(scenes.length, 1)) * 28), message: `Đã render ${index + 1}/${scenes.length} segment...` });
  }

  const segmentPaths = scenes.map((scene) => scene.outputPath);
  if (request.demoPath && fs.existsSync(request.demoPath)) {
    const productDuration = await probeDuration(request.demoPath);
    const productOverlay = path.join(workDir, 'product-overlay.png');
    await renderTextCard(productOverlay, request.analysis.affiliateProducts[0] || 'Sản phẩm phù hợp', ctaText, 'product');
    const productOutput = path.join(workDir, 'segment-product.mp4');
    await renderSilentOverlayScene(request.demoPath, productOverlay, productOutput, productDuration + silenceSecs);
    segmentPaths.push(productOutput);
  }

  if (outroScene) {
    await renderOverlayScene(request.backgroundPath, outroScene, silenceSecs);
    segmentPaths.push(outroScene.outputPath);
  }
  onProgress({ percent: 82, message: 'Đang ghép video hoàn chỉnh...' });
  await concatVideoSegments(segmentPaths, outputPath);
  onProgress({ percent: 87, message: 'Đang lồng nhạc nền...' });
  await mixBackgroundMusic(outputPath);

  onProgress({ percent: 90, message: 'Đang tạo metadata, checklist và thumbnail...' });
  await writeMetadata(workDir, request.analysis, ctaText, request.product, { provider: ttsProvider, voice, speed }, path.basename(outputPath));
  await extractThumbnails(outputPath, thumbDir);

  // F1 — variants: only hook + CTA change; every middle segment is reused byte-for-byte, so a
  // variant costs two TTS calls (or zero on cache hit) and two small segment renders.
  const variants = useOriginalPostReadOnly ? [] : (request.variants ?? []).filter((variant) => variant.hookText.trim() || variant.ctaText.trim()).slice(0, 2);
  const variantPaths: string[] = [];
  const middleSegments = segmentPaths.filter((segment) => (!outroScene || segment !== outroScene.outputPath) && (!hookScene || segment !== hookScene.outputPath));
  for (const [index, variant] of variants.entries()) {
    onProgress({ percent: 92 + index * 3, message: `Đang render variant ${index + 1}/${variants.length}...` });
    const variantDir = path.join(workDir, `variant-${index + 1}`);
    const variantThumbDir = path.join(variantDir, 'thumbnails');
    fs.mkdirSync(variantThumbDir, { recursive: true });
    const variantHookText = variant.hookText.trim() || hookText;
    const variantCtaText = variant.ctaText.trim() || ctaText;

    const variantHook = variantHookText
      ? await createTextScene(variantDir, 'hook', variantHookText, apiKey, voice, speed, 2, ttsFor('hook'), karaokeEnabled ? 'native-hook' : 'card')
      : null;
    const variantOutro = await createTextScene(variantDir, 'outro', variantCtaText, apiKey, voice, speed, 3, ttsFor('cta'), karaokeEnabled ? 'none' : 'card');
    if (karaokeEnabled) {
      const { words } = await getWordTimestamps(variantOutro.audioPath, openAiApiKey, request.post.id, variantOutro.speechText);
      if (words.length) {
        const assPath = variantOutro.audioPath.replace(/\.mp3$/i, '.ass');
        fs.writeFileSync(assPath, buildKaraokeAss(words), 'utf8');
        variantOutro.assPath = assPath;
      }
    }
    if (variantHook) await renderOverlayScene(request.backgroundPath, variantHook, silenceSecs);
    await renderOverlayScene(request.backgroundPath, variantOutro, silenceSecs);

    const variantOutput = path.join(exportDir, `${exportName}-variant-${index + 1}.mp4`);
    await concatVideoSegments([...(variantHook ? [variantHook.outputPath] : []), ...middleSegments, variantOutro.outputPath], variantOutput);
    await mixBackgroundMusic(variantOutput);
    await writeMetadata(variantDir, request.analysis, variantCtaText, request.product, { provider: ttsProvider, voice, speed }, path.basename(variantOutput));
    fs.writeFileSync(
      path.join(variantDir, 'variant-info.json'),
      JSON.stringify({ label: variant.label.trim() || `variant-${index + 1}`, hook: variantHookText, cta: variantCtaText }, null, 2),
      'utf8'
    );
    await extractThumbnails(variantOutput, variantThumbDir);
    variantPaths.push(variantOutput);
  }

  onProgress({ percent: 100, message: 'Đã tạo xong video affiliate.' });

  return { ok: true, message: `Video rendered with ${voice} at ${speed.toFixed(2)}x.`, filePath: outputPath, variantPaths: variantPaths.length ? variantPaths : undefined };
}

async function createSpokenScene(exportDir: string, name: string, text: string, post: ThreadsPost, reply: SelectedReply | undefined, apiKey: string, voice: TtsVoice, speed: number, instructions: string, speechText?: string): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  const narration = speechText ?? normalizeVietnameseForSpeech(text);
  await Promise.all([
    createVoiceover(apiKey, narration, audioPath, voice, speed, instructions),
    reply ? renderReplyCard(reply, imagePath) : renderPostCard(post, text, imagePath)
  ]);
  return { audioPath, imagePath, outputPath, duration: await probeDuration(audioPath), speechText: narration };
}

async function createTextScene(exportDir: string, name: string, text: string, apiKey: string, voice: TtsVoice, speed: number, minDuration: number, instructions: string, style: TextSceneStyle = 'card', speechText?: string): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = style === 'none' ? undefined : path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  const narration = speechText ?? normalizeVietnameseForSpeech(text);
  await Promise.all([
    createVoiceover(apiKey, narration, audioPath, voice, speed, instructions),
    imagePath
      ? style === 'native-hook'
        ? renderNativeHookImage(imagePath, text)
        : renderTextCard(imagePath, text, '', name === 'outro' ? 'outro' : 'transition')
      : Promise.resolve()
  ]);
  return { audioPath, imagePath, outputPath, duration: Math.max(minDuration, await probeDuration(audioPath)), speechText: narration };
}

async function createVoiceover(apiKey: string, input: string, outputPath: string, voice: TtsVoice, speed: number, instructions: string) {
  await synthesizeSpeech({
    apiKey,
    provider: getTtsProvider(),
    input,
    outputPath,
    voice,
    speed,
    instructions,
    relatedPostId: activePostId
  });
}

async function renderPostCard(post: ThreadsPost, text: string, outputPath: string) {
  await screenshotCard(outputPath, cardHtml(post.author, post.authorHandle || `@${post.author}`, text, {
    likes: post.likes,
    replies: post.replies,
    reposts: post.reposts
  }));
}

async function renderReplyCard(reply: SelectedReply, outputPath: string) {
  const author = formatThreadsUsername(reply.author);
  await screenshotCard(outputPath, cardHtml(author, '', reply.content, {
    likes: reply.likes,
    replies: reply.replies,
    reposts: reply.reposts,
    shares: reply.shares
  }, true, reply.authorAvatarUrl));
}

async function renderNativeHookImage(outputPath: string, text: string) {
  const lines = wrapText(text, 16)
    .map((line) => `<div class="line">${escapeHtml(line)}</div>`)
    .join('');
  const lineStyle =
    activeHookStyle === 'outline'
      ? '.line{color:#fff;font-size:66px;line-height:1.22;font-weight:800;text-align:center;text-shadow:-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000,0 4px 10px rgba(0,0,0,.55)}'
      : activeHookStyle === 'boxed'
        ? '.card{background:rgba(0,0,0,.68);border-radius:18px;padding:26px 30px}.line{color:#fff;font-size:62px;line-height:1.25;font-weight:800;text-align:center}'
        : '.line{display:inline-block;background:rgba(0,0,0,.68);color:#fff;font-size:64px;line-height:1.22;font-weight:800;padding:8px 22px;border-radius:14px;text-align:center}';
  await screenshotCard(
    outputPath,
    `<!doctype html><html><head><meta charset="UTF-8" /><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:transparent;font-family:Arial,sans-serif}.card{width:860px;display:flex;flex-direction:column;align-items:center;gap:8px}${lineStyle}</style></head><body><section class="card">${lines}</section></body></html>`
  );
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderTextCard(outputPath: string, title: string, subtitle: string, variant: 'transition' | 'solution' | 'product' | 'outro') {
  const accent = activeCardTheme[variant];
  await screenshotCard(
    outputPath,
    `<!doctype html><html><head><meta charset="UTF-8" /><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:transparent;font-family:Arial,sans-serif}.card{width:860px;padding:32px;border-radius:18px;background:rgba(12,15,19,.9);border:2px solid ${accent};box-shadow:0 14px 44px rgba(0,0,0,.34);color:#fff}.title{font-size:44px;line-height:1.3;font-weight:700}.subtitle{margin-top:18px;font-size:29px;line-height:1.4;color:#d1d5db}</style></head><body><section class="card"><div class="title">${escapeHtml(title)}</div>${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}</section></body></html>`
  );
}

async function screenshotCard(outputPath: string, html: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 920, height: 1400 } });
    await page.setContent(html);
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: 5_000 }
    ).catch(() => undefined);
    await page.locator('.card').screenshot({ path: outputPath });
  } finally {
    await browser.close();
  }
}

type CardReactions = {
  likes?: number;
  replies?: number;
  reposts?: number;
  shares?: number;
};

function cardHtml(author: string, meta: string, content: string, reactions: CardReactions, compact = false, avatarUrl?: string) {
  const avatarLetter = author.replace(/^@/, '').slice(0, 1).toUpperCase() || '@';
  const avatarImage = avatarUrl
    ? `<img class="avatar-image" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
    : '';
  const metaHtml = meta ? `<div class="meta">${escapeHtml(meta)}</div>` : '';
  return `<!doctype html><html><head><meta charset="UTF-8" /><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:transparent;font-family:Arial,sans-serif;color:#111827}.card{width:${compact ? 790 : 860}px;border-radius:16px;background:#fff;padding:${compact ? 20 : 27}px;box-shadow:0 14px 44px rgba(0,0,0,.24)}.head{display:flex;gap:13px;align-items:center}.avatar{position:relative;display:grid;width:44px;height:44px;flex:0 0 44px;overflow:hidden;place-items:center;border-radius:50%;background:#dbeafe;font-size:18px;font-weight:700}.avatar-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.author{font-size:22px;font-weight:700}.meta{color:#6b7280;font-size:16px}.content{margin-top:18px;white-space:pre-wrap;font-size:${compact ? 25 : 28}px;line-height:1.42}.reactions{display:flex;align-items:center;gap:28px;margin-top:20px;color:#4b5563}.reaction{display:flex;align-items:center;gap:7px;min-width:36px;font-size:16px}.reaction svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}</style></head><body><section class="card"><div class="head"><div class="avatar"><span>${escapeHtml(avatarLetter)}</span>${avatarImage}</div><div><div class="author">${escapeHtml(author)}</div>${metaHtml}</div></div><div class="content">${escapeHtml(content)}</div>${reactionHtml(reactions)}</section></body></html>`;
}

function reactionHtml(reactions: CardReactions) {
  return `<div class="reactions">${reactionItem('heart', reactions.likes)}${reactionItem('reply', reactions.replies)}${reactionItem('repost', reactions.reposts)}${reactionItem('share', reactions.shares)}</div>`;
}

function reactionItem(kind: 'heart' | 'reply' | 'repost' | 'share', count?: number) {
  const paths = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
    reply: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
    repost: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    share: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
  };
  const label = count && count > 0 ? formatCompactMetric(count) : '';
  return `<span class="reaction"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>${label ? `<span>${label}</span>` : ''}</span>`;
}

function formatCompactMetric(value: number) {
  if (value < 1_000) return String(Math.max(0, Math.round(value)));
  const units = [
    { size: 1_000_000_000, suffix: 'B' },
    { size: 1_000_000, suffix: 'M' },
    { size: 1_000, suffix: 'K' }
  ];
  const unit = units.find((candidate) => value >= candidate.size) ?? units[2];
  const compact = value / unit.size;
  return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, '')}${unit.suffix}`;
}

async function renderOverlayScene(backgroundPath: string, scene: Scene, silenceSecs = 0) {
  const args = ['-y', '-stream_loop', '-1', '-i', backgroundPath];
  if (scene.imagePath) args.push('-loop', '1', '-i', scene.imagePath);
  args.push('-i', scene.audioPath);
  const audioIndex = scene.imagePath ? 2 : 1;

  const filters = ['[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[bg]'];
  let videoLabel = '[bg]';
  if (scene.imagePath) {
    if (scene.assPath) {
      // Karaoke mode: shrink the card and pin it to the upper area so captions own the lower third.
      filters.push('[1:v]scale=880:-1[card]');
      filters.push(`${videoLabel}[card]overlay=(W-w)/2:170[v0]`);
    } else {
      filters.push(`${videoLabel}[1:v]overlay=(W-w)/2:(H-h)/2[v0]`);
    }
    videoLabel = '[v0]';
  }
  if (scene.assPath) {
    filters.push(`${videoLabel}${subtitlesFilterArg(scene.assPath)}[v1]`);
    videoLabel = '[v1]';
  }
  filters.push(`[${audioIndex}:a]apad[aout]`);

  await runFfmpeg([
    ...args,
    '-filter_complex', filters.join(';'),
    '-map', videoLabel, '-map', '[aout]', '-t', (scene.duration + silenceSecs).toFixed(3), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', scene.outputPath
  ]);
}

async function renderSilentOverlayScene(sourcePath: string, overlayPath: string, outputPath: string, duration: number) {
  await runFfmpeg([
    '-y', '-i', sourcePath, '-loop', '1', '-i', overlayPath, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[bg];[bg][1:v]overlay=(W-w)/2:H-h-220[v]`,
    '-map', '[v]', '-map', '2:a', '-t', duration.toFixed(3), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', outputPath
  ]);
}

async function concatVideoSegments(paths: string[], outputPath: string) {
  const concatPath = path.join(path.dirname(outputPath), 'segments.txt');
  fs.writeFileSync(concatPath, paths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
}

async function mixBackgroundMusic(videoPath: string) {
  const musicPath = backgroundMusicPath();
  if (!fs.existsSync(musicPath)) {
    throw new Error(`Background music is missing: ${musicPath}`);
  }

  const mixedPath = path.join(
    path.dirname(videoPath),
    `.${path.basename(videoPath, path.extname(videoPath))}.with-music-${crypto.randomUUID()}.mp4`
  );
  const filter = [
    '[0:a]aresample=async=1:first_pts=0[voice]',
    `[1:a]volume=${backgroundMusicVolume},aresample=async=1:first_pts=0[music]`,
    '[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[audio]'
  ].join(';');

  try {
    await runFfmpeg([
      '-y',
      '-i', videoPath,
      '-stream_loop', '-1',
      '-i', musicPath,
      '-filter_complex', filter,
      '-map', '0:v:0',
      '-map', '[audio]',
      '-map_metadata', '0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      mixedPath
    ]);
    fs.copyFileSync(mixedPath, videoPath);
  } finally {
    if (fs.existsSync(mixedPath)) fs.unlinkSync(mixedPath);
  }
}

async function writeMetadata(exportDir: string, analysis: AIAnalysis, ctaText: string, product: Product | undefined, tts: { provider: TtsProvider; voice: TtsVoice; speed: number }, finalFileName: string) {
  const useOriginalPostReadOnly = !getCreativeAiEnabled();
  const metadata = {
    caption_variants: useOriginalPostReadOnly ? [] : analysis.videoScript.captionVariants.length ? analysis.videoScript.captionVariants : [analysis.tiktokCaption].filter(Boolean),
    hashtags: analysis.hashtags,
    product: product
      ? {
          name: product.name,
          affiliate_link: product.affiliateLink,
          price: product.price,
          commission_percent: product.commissionPercent,
          marketplace: product.marketplace,
          tiktok_shop_keyword: analysis.marketplaceKeywords.tiktokShop,
          shopee_keyword: analysis.marketplaceKeywords.shopee
        }
      : { name: analysis.affiliateProducts[0] || '', tiktok_shop_keyword: analysis.marketplaceKeywords.tiktokShop, shopee_keyword: analysis.marketplaceKeywords.shopee },
    tts: {
      provider: tts.provider === 'vieneu' ? 'local_vieneu' : `${tts.provider}_api`,
      model: getTtsModel(tts.provider),
      voice: tts.voice,
      speed: tts.speed
    },
    upload_notes: 'Đăng thủ công trên TikTok, kiểm tra caption và gắn sản phẩm phù hợp trước khi publish.'
  };
  fs.writeFileSync(path.join(exportDir, 'tiktok-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  const checklist = [
    `Video đã render: ${finalFileName}`,
    'Metadata sẵn sàng: tiktok-metadata.json',
    '',
    '[ ] 1. Mở TikTok và chọn video',
    useOriginalPostReadOnly ? '[ ] 2. Viết caption thủ công' : '[ ] 2. Chọn caption từ metadata',
    '[ ] 3. Thêm hashtag',
    product
      ? `[ ] 4. Gắn đúng sản phẩm: ${product.name}${product.affiliateLink ? ` (${product.affiliateLink})` : ''}`
      : `[ ] 4. TikTok Shop: search "${metadata.product.tiktok_shop_keyword}" và gắn sản phẩm`,
    '[ ] 5. Chọn thumbnail từ thư mục thumbnails'
  ];
  if (ctaText) checklist.push(`[ ] 6. Kiểm tra CTA: ${ctaText}`);
  if (product) checklist.push('[ ] 7. Bật nhãn "Nội dung có gắn liên kết tiếp thị" (disclosure affiliate)');
  fs.writeFileSync(path.join(exportDir, 'upload-checklist.txt'), checklist.join('\n'), 'utf8');
}

function allocateExportDirectory() {
  const root = path.resolve(process.cwd(), 'data', 'video-exports');
  fs.mkdirSync(root, { recursive: true });
  const now = new Date();
  const base = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
  let index = 0;
  let exportName = base;
  while (fs.existsSync(path.join(root, exportName))) {
    index += 1;
    exportName = `${base}-${index}`;
  }
  const exportDir = path.join(root, exportName);
  fs.mkdirSync(exportDir, { recursive: false });
  return { exportDir, exportName };
}

async function extractThumbnails(videoPath: string, outputDir: string) {
  const duration = await probeDuration(videoPath);
  for (const [index, ratio] of [0.2, 0.5, 0.8].entries()) {
    await runFfmpeg(['-y', '-ss', (duration * ratio).toFixed(2), '-i', videoPath, '-frames:v', '1', '-q:v', '2', path.join(outputDir, `thumb_${String(index + 1).padStart(3, '0')}.jpg`)]);
  }
}

async function probeDuration(filePath: string) {
  const output = await runProcess('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
  const duration = Number(output.trim());
  if (!Number.isFinite(duration)) throw new Error('Unable to detect media duration.');
  return duration;
}

async function runFfmpeg(args: string[]) {
  await withRetry(() => runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], process.cwd()));
}

function runProcess(command: string, args: string[], cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => reject(new Error(`${command} could not start. Install FFmpeg and add it to PATH. ${error.message}`)));
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} failed (${code}). ${stderr.slice(-1200)}`)));
  });
}

function formatThreadsUsername(value?: string) {
  return value?.trim().replace(/^@/, '') || 'Threads user';
}

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96) || crypto.randomUUID();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}
