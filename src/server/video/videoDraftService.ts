import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { AIAnalysis, Product, SelectedReply, ThreadsPost, TtsSegmentKind, VideoDraftProgress, VideoDraftResult, VideoDraftVariant } from '@/lib/types';
import { getDefaultSpeed, getDefaultVoice, getKaraokeCaptionsEnabled, getOpenAiApiKey, getSegmentSilenceMs, getSetting, getTiktokChannelName, getTtsInstruction, logApiUsage, setSetting } from '@/server/db/client';
import { buildKaraokeAss, ensureSubtitlesFilterAvailable, subtitlesFilterArg } from '@/server/video/subtitleService';
import { getWordTimestamps } from '@/server/video/transcriptionService';
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
};

type TextSceneStyle = 'card' | 'native-hook' | 'none';

// D4 — template rotation: vary card palette, hook style and TTS delivery between renders
// so consecutive videos do not look machine-stamped. State persists in app_settings.
const cardThemes: Record<string, { transition: string; solution: string; product: string; outro: string }> = {
  classic: { transition: '#fbbf24', solution: '#22c55e', product: '#22c55e', outro: '#38bdf8' },
  sunset: { transition: '#fb923c', solution: '#34d399', product: '#34d399', outro: '#a78bfa' },
  candy: { transition: '#f472b6', solution: '#4ade80', product: '#4ade80', outro: '#22d3ee' }
};
type HookStyle = 'pill' | 'outline' | 'boxed';
const hookStyles: HookStyle[] = ['pill', 'outline', 'boxed'];
const ttsDeliveryVariants = ['', ' Nhịp kể nhanh hơn bình thường một chút.', ' Nhịp kể thong thả hơn bình thường một chút.'];

let activeCardTheme = cardThemes.classic;
let activeHookStyle: HookStyle = 'pill';
let activePostId: string | undefined;

function pickTemplateRotation(): { ttsSuffix: string } {
  const state = safeJsonParse<{ lastCardTheme?: string; lastHookStyle?: string; lastTtsVariant?: number }>(getSetting('video.template_rotation_state') ?? '{}');
  const themeKey = pickDifferent(Object.keys(cardThemes), state.lastCardTheme);
  const hookStyle = pickDifferent(hookStyles, state.lastHookStyle) as HookStyle;
  const ttsVariant = pickDifferentIndex(ttsDeliveryVariants.length, state.lastTtsVariant);
  activeCardTheme = cardThemes[themeKey];
  activeHookStyle = hookStyle;
  setSetting('video.template_rotation_state', JSON.stringify({ lastCardTheme: themeKey, lastHookStyle: hookStyle, lastTtsVariant: ttsVariant }));
  return { ttsSuffix: ttsDeliveryVariants[ttsVariant] };
}

function pickDifferent(options: readonly string[], last?: string): string {
  const pool = options.filter((option) => option !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? options[0];
}

function pickDifferentIndex(length: number, last?: number): number {
  const pool = Array.from({ length }, (_, index) => index).filter((index) => index !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? 0;
}

function safeJsonParse<T>(value: string): Partial<T> {
  try {
    return JSON.parse(value) as Partial<T>;
  } catch {
    return {};
  }
}

export async function renderVideoDraft(request: RenderVideoDraftRequest, onProgress: (progress: VideoDraftProgress) => void = () => {}): Promise<VideoDraftResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before generating a video voiceover.');
  if (!request.backgroundPath || !fs.existsSync(request.backgroundPath)) throw new Error('Background clip is missing. Select a valid clip from Asset Library before rendering.');
  const karaokeEnabled = getKaraokeCaptionsEnabled();
  if (karaokeEnabled) await ensureSubtitlesFilterAvailable();

  const exportDir = path.resolve(process.cwd(), 'data', 'video-exports', safeFileName(request.post.id));
  const thumbDir = path.join(exportDir, 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });
  const outputPath = path.join(exportDir, 'affiliate-video-final.mp4');
  const voice = getDefaultVoice();
  const speed = getDefaultSpeed();
  const hookText = request.hookText?.trim() || request.analysis.hooks[0]?.trim() || '';
  const postText = request.postReadVersion?.trim() || request.analysis.videoScript.postReadVersion.trim() || request.post.content;
  const replies = (request.selectedReplies ?? request.analysis.bestReplies).filter((reply) => reply.content.trim()).slice(0, 6);
  const transitionLine = request.transitionLine?.trim() || request.analysis.videoScript.transitionLine.trim() || 'Nhưng có một món nhỏ xử lý gọn lắm.';
  const solutionText = request.solutionText?.trim() || request.analysis.videoScript.solutionText?.trim() || request.analysis.solutionScript.trim() || 'Thử dùng món này xem sao nha. Nhỏ gọn, dễ dùng và có thể demo trực tiếp trong video.';
  const ctaText = request.ctaText?.trim() || request.analysis.videoScript.ctaText.trim() || request.analysis.ctas[0] || 'Thử tham khảo nếu bạn cũng gặp tình trạng này nhé.';

  const silenceSecs = getSegmentSilenceMs() / 1000;
  activePostId = request.post.id;
  const rotation = pickTemplateRotation();
  const ttsFor = (kind: TtsSegmentKind) => getTtsInstruction(kind) + rotation.ttsSuffix;

  onProgress({ percent: 16, message: 'Đang tạo voiceover cho hook, post và replies...' });
  const hookScene = hookText ? await createTextScene(exportDir, 'hook', hookText, apiKey, voice, Math.min(speed + 0.08, 1.3), 2, ttsFor('hook'), karaokeEnabled ? 'native-hook' : 'card') : null;
  const postScene = await createSpokenScene(exportDir, 'post', postText, request.post, undefined, apiKey, voice, speed, ttsFor('post'));
  const replyScenes = await Promise.all(
    replies.map((reply, index) => createSpokenScene(exportDir, `reply-${index + 1}`, reply.content, request.post, reply, apiKey, 'nova', Math.min(speed + 0.05, 1.3), ttsFor('reply')))
  );
  const transitionScene = await createTextScene(exportDir, 'transition', transitionLine, apiKey, 'nova', Math.min(speed + 0.05, 1.3), 2, ttsFor('transition'), karaokeEnabled ? 'none' : 'card');
  const solutionScene = await createTextScene(exportDir, 'solution', solutionText, apiKey, 'nova', Math.min(speed + 0.05, 1.3), 4, ttsFor('solution'), karaokeEnabled ? 'none' : 'card');
  const outroScene = await createTextScene(exportDir, 'outro', ctaText, apiKey, voice, speed, 3, ttsFor('cta'), karaokeEnabled ? 'none' : 'card');

  const scenes = [hookScene, postScene, ...replyScenes, transitionScene, solutionScene].filter((scene): scene is Scene => Boolean(scene));

  if (karaokeEnabled) {
    onProgress({ percent: 42, message: 'Đang tạo phụ đề karaoke...' });
    for (const scene of [postScene, ...replyScenes, transitionScene, solutionScene, outroScene]) {
      const { words } = await getWordTimestamps(scene.audioPath, apiKey, request.post.id);
      if (!words.length) continue;
      const assPath = scene.audioPath.replace(/\.mp3$/i, '.ass');
      fs.writeFileSync(assPath, buildKaraokeAss(words), 'utf8');
      scene.assPath = assPath;
    }
  }
  onProgress({ percent: 48, message: 'Đang render từng segment độc lập...' });
  for (let index = 0; index < scenes.length; index += 1) {
    await renderOverlayScene(request.backgroundPath, scenes[index], silenceSecs);
    onProgress({ percent: 48 + Math.round(((index + 1) / (scenes.length + 2)) * 28), message: `Đã render ${index + 1}/${scenes.length + 2} segment...` });
  }

  const segmentPaths = scenes.map((scene) => scene.outputPath);
  if (request.demoPath && fs.existsSync(request.demoPath)) {
    const productDuration = await probeDuration(request.demoPath);
    const productOverlay = path.join(exportDir, 'product-overlay.png');
    await renderTextCard(productOverlay, request.analysis.affiliateProducts[0] || 'Sản phẩm phù hợp', ctaText, 'product');
    const productOutput = path.join(exportDir, 'segment-product.mp4');
    await renderSilentOverlayScene(request.demoPath, productOverlay, productOutput, productDuration + silenceSecs);
    segmentPaths.push(productOutput);
  }

  await renderOverlayScene(request.backgroundPath, outroScene, silenceSecs);
  segmentPaths.push(outroScene.outputPath);
  onProgress({ percent: 82, message: 'Đang ghép video hoàn chỉnh...' });
  await concatVideoSegments(segmentPaths, outputPath);

  onProgress({ percent: 90, message: 'Đang tạo metadata, checklist và thumbnail...' });
  await writeMetadata(exportDir, request.analysis, ctaText, request.product);
  await extractThumbnails(outputPath, thumbDir);

  // F1 — variants: only hook + CTA change; every middle segment is reused byte-for-byte, so a
  // variant costs two TTS calls (or zero on cache hit) and two small segment renders.
  const variants = (request.variants ?? []).filter((variant) => variant.hookText.trim() || variant.ctaText.trim()).slice(0, 2);
  const variantPaths: string[] = [];
  const middleSegments = segmentPaths.filter((segment) => segment !== outroScene.outputPath && (!hookScene || segment !== hookScene.outputPath));
  for (const [index, variant] of variants.entries()) {
    onProgress({ percent: 92 + index * 3, message: `Đang render variant ${index + 1}/${variants.length}...` });
    const variantDir = path.join(exportDir, `variant-${index + 1}`);
    const variantThumbDir = path.join(variantDir, 'thumbnails');
    fs.mkdirSync(variantThumbDir, { recursive: true });
    const variantHookText = variant.hookText.trim() || hookText;
    const variantCtaText = variant.ctaText.trim() || ctaText;

    const variantHook = variantHookText
      ? await createTextScene(variantDir, 'hook', variantHookText, apiKey, voice, Math.min(speed + 0.08, 1.3), 2, ttsFor('hook'), karaokeEnabled ? 'native-hook' : 'card')
      : null;
    const variantOutro = await createTextScene(variantDir, 'outro', variantCtaText, apiKey, voice, speed, 3, ttsFor('cta'), karaokeEnabled ? 'none' : 'card');
    if (karaokeEnabled) {
      const { words } = await getWordTimestamps(variantOutro.audioPath, apiKey, request.post.id);
      if (words.length) {
        const assPath = variantOutro.audioPath.replace(/\.mp3$/i, '.ass');
        fs.writeFileSync(assPath, buildKaraokeAss(words), 'utf8');
        variantOutro.assPath = assPath;
      }
    }
    if (variantHook) await renderOverlayScene(request.backgroundPath, variantHook, silenceSecs);
    await renderOverlayScene(request.backgroundPath, variantOutro, silenceSecs);

    const variantOutput = path.join(variantDir, 'affiliate-video-final.mp4');
    await concatVideoSegments([...(variantHook ? [variantHook.outputPath] : []), ...middleSegments, variantOutro.outputPath], variantOutput);
    await writeMetadata(variantDir, request.analysis, variantCtaText, request.product);
    fs.writeFileSync(
      path.join(variantDir, 'variant-info.json'),
      JSON.stringify({ label: variant.label.trim() || `variant-${index + 1}`, hook: variantHookText, cta: variantCtaText }, null, 2),
      'utf8'
    );
    await extractThumbnails(variantOutput, variantThumbDir);
    variantPaths.push(variantOutput);
  }

  onProgress({ percent: 100, message: 'Đã tạo xong video affiliate.' });

  return { ok: true, message: 'Video rendered with metadata and upload checklist.', filePath: outputPath, variantPaths: variantPaths.length ? variantPaths : undefined };
}

async function createSpokenScene(exportDir: string, name: string, text: string, post: ThreadsPost, reply: SelectedReply | undefined, apiKey: string, voice: string, speed: number, instructions: string): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  await Promise.all([
    createOpenAiVoiceover(apiKey, text, audioPath, voice, speed, instructions),
    reply ? renderReplyCard(reply, imagePath) : renderPostCard(post, text, imagePath)
  ]);
  return { audioPath, imagePath, outputPath, duration: await probeDuration(audioPath) };
}

async function createTextScene(exportDir: string, name: string, text: string, apiKey: string, voice: string, speed: number, minDuration: number, instructions: string, style: TextSceneStyle = 'card'): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = style === 'none' ? undefined : path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  await Promise.all([
    createOpenAiVoiceover(apiKey, text, audioPath, voice, speed, instructions),
    imagePath
      ? style === 'native-hook'
        ? renderNativeHookImage(imagePath, text)
        : renderTextCard(imagePath, text, '', name === 'outro' ? 'outro' : 'transition')
      : Promise.resolve()
  ]);
  return { audioPath, imagePath, outputPath, duration: Math.max(minDuration, await probeDuration(audioPath)) };
}

async function createOpenAiVoiceover(apiKey: string, input: string, outputPath: string, voice: string, speed: number, instructions: string) {
  const cacheDir = path.resolve(process.cwd(), 'data', 'tts-cache');
  const cacheKey = crypto.createHash('sha256').update(JSON.stringify({ model: 'gpt-4o-mini-tts', input, voice, speed, instructions })).digest('hex');
  const cachePath = path.join(cacheDir, `${cacheKey}.mp3`);
  if (fs.existsSync(cachePath)) {
    fs.copyFileSync(cachePath, outputPath);
    return;
  }

  await withRetry(async () => {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input,
        speed,
        instructions
      })
    });
    if (!response.ok) throw new Error(`OpenAI TTS failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.copyFileSync(outputPath, cachePath);
  logApiUsage({ kind: 'tts', model: 'gpt-4o-mini-tts', inputUnits: input.length, relatedPostId: activePostId });
}

async function renderPostCard(post: ThreadsPost, text: string, outputPath: string) {
  await screenshotCard(outputPath, cardHtml(post.author, post.authorHandle || `@${post.author}`, text, `${post.likes} likes  ·  ${post.replies} replies  ·  ${post.reposts} reposts`, getTiktokChannelName()));
}

async function renderReplyCard(reply: SelectedReply, outputPath: string) {
  const author = anonymousHandle(reply.author || reply.id || reply.content);
  await screenshotCard(outputPath, cardHtml(author, 'Reply · Threads', reply.content, `${reply.likes ?? 0} likes`, getTiktokChannelName(), true));
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
    await page.locator('.card').screenshot({ path: outputPath });
  } finally {
    await browser.close();
  }
}

function cardHtml(author: string, meta: string, content: string, stats: string, watermark: string, compact = false) {
  return `<!doctype html><html><head><meta charset="UTF-8" /><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:transparent;font-family:Arial,sans-serif;color:#111827}.card{width:${compact ? 790 : 860}px;border-radius:16px;background:#fff;padding:${compact ? 20 : 27}px;box-shadow:0 14px 44px rgba(0,0,0,.24)}.head{display:flex;gap:13px;align-items:center}.avatar{display:grid;width:44px;height:44px;place-items:center;border-radius:50%;background:#dbeafe;font-size:18px;font-weight:700}.author{font-size:22px;font-weight:700}.meta{color:#6b7280;font-size:16px}.content{margin-top:18px;white-space:pre-wrap;font-size:${compact ? 25 : 28}px;line-height:1.42}.footer{display:flex;justify-content:space-between;margin-top:18px;color:#6b7280;font-size:16px}.watermark{font-size:13px;color:#9ca3af}</style></head><body><section class="card"><div class="head"><div class="avatar">${escapeHtml(author.slice(0, 1).toUpperCase())}</div><div><div class="author">${escapeHtml(author)}</div><div class="meta">${escapeHtml(meta)}</div></div></div><div class="content">${escapeHtml(content)}</div><div class="footer"><span>${escapeHtml(stats)}</span><span class="watermark">${escapeHtml(watermark)}</span></div></section></body></html>`;
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

async function writeMetadata(exportDir: string, analysis: AIAnalysis, ctaText: string, product?: Product) {
  const metadata = {
    caption_variants: analysis.videoScript.captionVariants.length ? analysis.videoScript.captionVariants : [analysis.tiktokCaption].filter(Boolean),
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
    upload_notes: 'Đăng thủ công trên TikTok, kiểm tra caption và gắn sản phẩm phù hợp trước khi publish.'
  };
  fs.writeFileSync(path.join(exportDir, 'tiktok-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  const checklist = [
    'Video đã render: affiliate-video-final.mp4',
    'Metadata sẵn sàng: tiktok-metadata.json',
    '',
    '[ ] 1. Mở TikTok và chọn video',
    '[ ] 2. Chọn caption từ metadata',
    '[ ] 3. Thêm hashtag',
    product
      ? `[ ] 4. Gắn đúng sản phẩm: ${product.name}${product.affiliateLink ? ` (${product.affiliateLink})` : ''}`
      : `[ ] 4. TikTok Shop: search "${metadata.product.tiktok_shop_keyword}" và gắn sản phẩm`,
    '[ ] 5. Chọn thumbnail từ thư mục thumbnails',
    `[ ] 6. Kiểm tra CTA: ${ctaText}`
  ];
  if (product) checklist.push('[ ] 7. Bật nhãn "Nội dung có gắn liên kết tiếp thị" (disclosure affiliate)');
  fs.writeFileSync(path.join(exportDir, 'upload-checklist.txt'), checklist.join('\n'), 'utf8');
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

function anonymousHandle(value: string) {
  return `@user_${crypto.createHash('sha1').update(value).digest('hex').slice(0, 4)}`;
}

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96) || crypto.randomUUID();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}
