import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { AIAnalysis, SelectedReply, ThreadsPost, VideoDraftProgress, VideoDraftResult } from '@/lib/types';
import { getDefaultSpeed, getDefaultVoice, getOpenAiApiKey, getTiktokChannelName } from '@/server/db/client';
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
};

type Scene = {
  audioPath: string;
  duration: number;
  imagePath: string;
  outputPath: string;
};

export async function renderVideoDraft(request: RenderVideoDraftRequest, onProgress: (progress: VideoDraftProgress) => void = () => {}): Promise<VideoDraftResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before generating a video voiceover.');
  if (!request.backgroundPath || !fs.existsSync(request.backgroundPath)) throw new Error('Background clip is missing. Select a valid clip from Asset Library before rendering.');

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

  onProgress({ percent: 16, message: 'Đang tạo voiceover cho hook, post và replies...' });
  const hookScene = hookText ? await createTextScene(exportDir, 'hook', hookText, apiKey, voice, Math.min(speed + 0.08, 1.3), 2) : null;
  const postScene = await createSpokenScene(exportDir, 'post', postText, request.post, undefined, apiKey, voice, speed);
  const replyScenes = await Promise.all(
    replies.map((reply, index) => createSpokenScene(exportDir, `reply-${index + 1}`, reply.content, request.post, reply, apiKey, 'nova', Math.min(speed + 0.05, 1.3)))
  );
  const transitionScene = await createTextScene(exportDir, 'transition', transitionLine, apiKey, 'nova', Math.min(speed + 0.05, 1.3), 2);
  const solutionScene = await createTextScene(exportDir, 'solution', solutionText, apiKey, 'nova', Math.min(speed + 0.05, 1.3), 4);
  const outroScene = await createTextScene(exportDir, 'outro', ctaText, apiKey, voice, speed, 3);

  const scenes = [hookScene, postScene, ...replyScenes, transitionScene, solutionScene].filter((scene): scene is Scene => Boolean(scene));
  onProgress({ percent: 48, message: 'Đang render từng segment độc lập...' });
  for (let index = 0; index < scenes.length; index += 1) {
    await renderOverlayScene(request.backgroundPath, scenes[index]);
    onProgress({ percent: 48 + Math.round(((index + 1) / (scenes.length + 2)) * 28), message: `Đã render ${index + 1}/${scenes.length + 2} segment...` });
  }

  const segmentPaths = scenes.map((scene) => scene.outputPath);
  if (request.demoPath && fs.existsSync(request.demoPath)) {
    const productDuration = await probeDuration(request.demoPath);
    const productOverlay = path.join(exportDir, 'product-overlay.png');
    await renderTextCard(productOverlay, request.analysis.affiliateProducts[0] || 'Sản phẩm phù hợp', ctaText, 'product');
    const productOutput = path.join(exportDir, 'segment-product.mp4');
    await renderSilentOverlayScene(request.demoPath, productOverlay, productOutput, productDuration);
    segmentPaths.push(productOutput);
  }

  await renderOverlayScene(request.backgroundPath, outroScene);
  segmentPaths.push(outroScene.outputPath);
  onProgress({ percent: 82, message: 'Đang ghép video hoàn chỉnh...' });
  await concatVideoSegments(segmentPaths, outputPath);

  onProgress({ percent: 90, message: 'Đang tạo metadata, checklist và thumbnail...' });
  await writeMetadata(exportDir, request.analysis, ctaText);
  await extractThumbnails(outputPath, thumbDir);
  onProgress({ percent: 100, message: 'Đã tạo xong video affiliate.' });

  return { ok: true, message: 'Video rendered with metadata and upload checklist.', filePath: outputPath };
}

async function createSpokenScene(exportDir: string, name: string, text: string, post: ThreadsPost, reply: SelectedReply | undefined, apiKey: string, voice: string, speed: number): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  await Promise.all([
    createOpenAiVoiceover(apiKey, text, audioPath, voice, speed),
    reply ? renderReplyCard(reply, imagePath) : renderPostCard(post, text, imagePath)
  ]);
  return { audioPath, imagePath, outputPath, duration: await probeDuration(audioPath) };
}

async function createTextScene(exportDir: string, name: string, text: string, apiKey: string, voice: string, speed: number, minDuration: number): Promise<Scene> {
  const audioPath = path.join(exportDir, `${name}.mp3`);
  const imagePath = path.join(exportDir, `${name}.png`);
  const outputPath = path.join(exportDir, `segment-${name}.mp4`);
  await Promise.all([createOpenAiVoiceover(apiKey, text, audioPath, voice, speed), renderTextCard(imagePath, text, '', name === 'outro' ? 'outro' : 'transition')]);
  return { audioPath, imagePath, outputPath, duration: Math.max(minDuration, await probeDuration(audioPath)) };
}

async function createOpenAiVoiceover(apiKey: string, input: string, outputPath: string, voice: string, speed: number) {
  await withRetry(async () => {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input,
        speed,
        instructions: 'Đọc tiếng Việt rõ ràng, tự nhiên, nhịp nhanh như video TikTok kể chuyện. Không tự thêm hoặc bớt nội dung.'
      })
    });
    if (!response.ok) throw new Error(`OpenAI TTS failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  });
}

async function renderPostCard(post: ThreadsPost, text: string, outputPath: string) {
  await screenshotCard(outputPath, cardHtml(post.author, post.authorHandle || `@${post.author}`, text, `${post.likes} likes  ·  ${post.replies} replies  ·  ${post.reposts} reposts`, getTiktokChannelName()));
}

async function renderReplyCard(reply: SelectedReply, outputPath: string) {
  const author = anonymousHandle(reply.author || reply.id || reply.content);
  await screenshotCard(outputPath, cardHtml(author, 'Reply · Threads', reply.content, `${reply.likes ?? 0} likes`, getTiktokChannelName(), true));
}

async function renderTextCard(outputPath: string, title: string, subtitle: string, variant: 'transition' | 'solution' | 'product' | 'outro') {
  const accent = variant === 'solution' || variant === 'product' ? '#22c55e' : variant === 'outro' ? '#38bdf8' : '#fbbf24';
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

async function renderOverlayScene(backgroundPath: string, scene: Scene) {
  await runFfmpeg([
    '-y', '-stream_loop', '-1', '-i', backgroundPath, '-loop', '1', '-i', scene.imagePath, '-i', scene.audioPath,
    '-filter_complex', `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[bg];[bg][1:v]overlay=(W-w)/2:(H-h)/2[v]`,
    '-map', '[v]', '-map', '2:a', '-t', scene.duration.toFixed(3), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', scene.outputPath
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

async function writeMetadata(exportDir: string, analysis: AIAnalysis, ctaText: string) {
  const metadata = {
    caption_variants: analysis.videoScript.captionVariants.length ? analysis.videoScript.captionVariants : [analysis.tiktokCaption].filter(Boolean),
    hashtags: analysis.hashtags,
    product: { name: analysis.affiliateProducts[0] || '', tiktok_shop_keyword: analysis.marketplaceKeywords.tiktokShop, shopee_keyword: analysis.marketplaceKeywords.shopee },
    upload_notes: 'Đăng thủ công trên TikTok, kiểm tra caption và gắn sản phẩm phù hợp trước khi publish.'
  };
  fs.writeFileSync(path.join(exportDir, 'tiktok-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  fs.writeFileSync(path.join(exportDir, 'upload-checklist.txt'), [
    'Video đã render: affiliate-video-final.mp4',
    'Metadata sẵn sàng: tiktok-metadata.json',
    '',
    '[ ] 1. Mở TikTok và chọn video',
    '[ ] 2. Chọn caption từ metadata',
    '[ ] 3. Thêm hashtag',
    `[ ] 4. TikTok Shop: search "${metadata.product.tiktok_shop_keyword}" và gắn sản phẩm`,
    '[ ] 5. Chọn thumbnail từ thư mục thumbnails',
    `[ ] 6. Kiểm tra CTA: ${ctaText}`
  ].join('\n'), 'utf8');
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
