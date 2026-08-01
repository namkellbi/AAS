import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import type { TikTokPerformanceSyncResult, TikTokPublishResult } from '@/lib/types';
import { ensureTikTokHashtags } from '@/lib/tiktokCaption';
import { assertGeneratedVideoPath, listGeneratedVideos, setGeneratedVideoPublishState } from '@/server/services/assetLibraryService';
import { getSetting, listUploadLogs, saveUploadLog, setSetting } from '@/server/db/client';

const uploadUrls = [
  'https://www.tiktok.com/tiktokstudio/upload?from=webapp',
  'https://www.tiktok.com/upload'
] as const;
const dedicatedProfileDir = path.resolve(process.cwd(), 'data', 'tiktok-browser-profile');
const chromeUserDataDir = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data')
  : dedicatedProfileDir;
const automationProfileEmail = 'commentdao.work@gmail.com';

export async function syncTikTokPerformance(): Promise<TikTokPerformanceSyncResult> {
  const logs = listUploadLogs();
  const candidates = logs.filter((log) => /^https?:\/\/(?:www\.)?tiktok\.com\//i.test(log.tiktokUrl));
  if (!candidates.length) return { ok: true, message: 'Chưa có video TikTok nào để đồng bộ.', logs, updated: 0 };

  let context: BrowserContext | undefined;
  let updated = 0;
  const errors: string[] = [];
  try {
    context = await launchAutomationContext();
    if (!await hasTikTokSession(context)) throw new Error('Session TikTok đã hết hạn. Hãy đăng nhập lại trước khi đồng bộ.');
    const page = context.pages()[0] ?? await context.newPage();
    for (const log of candidates) {
      try {
        await page.goto(log.tiktokUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForTimeout(2500);
        const metrics = await readTikTokPostMetrics(page);
        if (!metrics) throw new Error('không đọc được số liệu');
        saveUploadLog({
          ...log,
          views: metrics.views ?? log.views ?? 0,
          likes: metrics.likes ?? log.likes ?? 0,
          comments: metrics.comments ?? log.comments ?? 0,
          saves: metrics.saves ?? log.saves ?? 0,
          shares: metrics.shares ?? log.shares ?? 0,
          status: log.status === 'published' ? 'tracking' : log.status
        });
        updated += 1;
      } catch (error) {
        errors.push(`${log.tiktokUrl}: ${cleanBrowserError(error instanceof Error ? error.message : String(error))}`);
      }
    }
    await syncFollowerGrowth(page).catch(() => undefined);
    const message = errors.length
      ? `Đã cập nhật ${updated}/${candidates.length} video. ${errors.length} video chưa đọc được số liệu.`
      : `Đã đồng bộ ${updated} video từ TikTok.`;
    return { ok: updated > 0 || !errors.length, message, logs: listUploadLogs(), updated };
  } catch (error) {
    const message = cleanBrowserError(error instanceof Error ? error.message : String(error));
    return { ok: false, message, logs: listUploadLogs(), updated };
  } finally {
    await context?.close().catch(() => undefined);
  }
}

async function syncFollowerGrowth(page: Page) {
  const profileHref = await page.locator('a[href^="/@"]').first().getAttribute('href').catch(() => null);
  if (!profileHref) return;
  await page.goto(new URL(profileHref, 'https://www.tiktok.com').toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  const followers = parseCompactMetric(await page.locator('[data-e2e="followers-count"]').first().textContent().catch(() => ''));
  if (followers === undefined) return;

  const baselineKey = 'tiktok.followers_baseline';
  const storedValue = getSetting(baselineKey);
  const storedBaseline = storedValue === null ? Number.NaN : Number(storedValue);
  if (!Number.isFinite(storedBaseline) || storedBaseline < 0) setSetting(baselineKey, String(followers));
  const baseline = Number.isFinite(storedBaseline) && storedBaseline >= 0 ? storedBaseline : followers;
  const gained = Math.max(0, followers - baseline);
  const currentLogs = listUploadLogs();
  const newest = currentLogs.find((log) => log.tiktokUrl);
  for (const log of currentLogs) {
    if (!log.tiktokUrl) continue;
    saveUploadLog({ ...log, followersGained: log.id === newest?.id ? gained : 0 });
  }
  setSetting('tiktok.followers_current', String(followers));
}

export async function publishGeneratedVideoToTikTok(filePath: string, caption: string): Promise<TikTokPublishResult> {
  const resolved = assertGeneratedVideoPath(filePath);
  const item = listGeneratedVideos().find((video) => video.filePath === resolved);
  if (!item) throw new Error('Generated video was not found.');
  if (item.reviewStatus !== 'approved') throw new Error('Only approved videos can be published.');
  if (item.publishStatus === 'publishing') throw new Error('This video is already being published.');
  if (item.publishStatus === 'published') throw new Error('This video has already been published.');
  if (!fs.existsSync(resolved)) throw new Error('The final MP4 no longer exists.');

  const normalizedCaption = ensureTikTokHashtags(caption);
  setGeneratedVideoPublishState(resolved, { status: 'publishing', caption: normalizedCaption });
  const automationProfileDirectory = findChromeProfileDirectory(automationProfileEmail);
  let context: BrowserContext | undefined;

  try {
    prepareDedicatedAutomationProfile(automationProfileDirectory);
    context = await launchAutomationContext();
    if (!await hasTikTokSession(context)) {
      await context.close();
      context = undefined;
      await runInteractiveTikTokLogin();
      context = await launchAutomationContext();
      if (!await hasTikTokSession(context)) {
        throw new Error('TikTok chưa tạo session đăng nhập. Hãy đăng nhập lại bằng QR và xác nhận đúng tài khoản trên điện thoại.');
      }
    }
    const page = await context.newPage();
    await openUploadPage(page);
    const fileInput = page.locator('input[type="file"]').first();
    await waitForUploadPage(page, fileInput);
    await fileInput.setInputFiles(resolved);
    await fillCaption(page, normalizedCaption);
    const publishButton = await waitForPublishButton(page);
    await publishButton.click();
    const publishedUrl = await waitForPublishedUrl(page);
    if (!publishedUrl) {
      setGeneratedVideoPublishState(resolved, {
        status: 'verification_required',
        caption: normalizedCaption,
        error: 'TikTok accepted the publish action, but the new post URL could not be verified automatically.'
      });
      return { ok: false, message: 'TikTok đã nhận thao tác đăng nhưng chưa xác minh được URL. Hãy kiểm tra TikTok trước khi thử lại.', videos: listGeneratedVideos() };
    }

    setGeneratedVideoPublishState(resolved, { status: 'published', caption: normalizedCaption, publishedUrl });
    return { ok: true, message: 'Video đã được đăng lên TikTok.', publishedUrl, videos: listGeneratedVideos() };
  } catch (error) {
    const rawMessage = cleanBrowserError(error instanceof Error ? error.message : String(error));
    const message = isChromeProfileLockedError(rawMessage)
      ? 'Profile automation đang được sử dụng. Hãy đóng cửa sổ Chrome do app mở, chờ vài giây rồi bấm Xuất bản lại.'
      : isProfileCopyError(rawMessage)
        ? 'Không thể khởi tạo profile automation vì Chrome đang sử dụng profile TiktokAutomation. Hãy đóng Chrome một lần rồi bấm Xuất bản lại.'
      : rawMessage;
    setGeneratedVideoPublishState(resolved, { status: 'failed', caption: normalizedCaption, error: message });
    return { ok: false, message, videos: listGeneratedVideos() };
  } finally {
    await context?.close().catch(() => undefined);
  }
}

function launchAutomationContext() {
  return chromium.launchPersistentContext(dedicatedProfileDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1360, height: 900 },
    args: ['--profile-directory=Default']
  });
}

async function runInteractiveTikTokLogin() {
  const chromeExecutable = findChromeExecutable();
  if (!chromeExecutable) throw new Error('Không tìm thấy Google Chrome để mở phiên đăng nhập TikTok.');

  await new Promise<void>((resolve, reject) => {
    const loginBrowser = spawn(chromeExecutable, [
      `--user-data-dir=${dedicatedProfileDir}`,
      '--profile-directory=Default',
      'https://www.tiktok.com/login'
    ], { stdio: 'ignore', windowsHide: false });
    loginBrowser.once('error', reject);
    loginBrowser.once('exit', (code) => code === 0 || code === null
      ? resolve()
      : reject(new Error(`Chrome đăng nhập đã đóng với mã lỗi ${code}.`)));
  });
}

function findChromeExecutable() {
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function prepareDedicatedAutomationProfile(sourceProfileDirectory?: string) {
  const markerPath = path.join(dedicatedProfileDir, 'automation-profile.json');
  if (fs.existsSync(markerPath)) return;

  fs.mkdirSync(dedicatedProfileDir, { recursive: true });
  if (!sourceProfileDirectory) return;
  const sourceProfile = path.join(chromeUserDataDir, sourceProfileDirectory);
  if (!fs.existsSync(sourceProfile)) return;

  const excludedNames = new Set([
    'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'GrShaderCache',
    'GraphiteDawnCache', 'History', 'History-journal', 'Login Data',
    'Login Data-journal', 'Web Data', 'Web Data-journal', 'Top Sites',
    'Top Sites-journal', 'Visited Links'
  ]);
  fs.copyFileSync(path.join(chromeUserDataDir, 'Local State'), path.join(dedicatedProfileDir, 'Local State'));
  fs.cpSync(sourceProfile, path.join(dedicatedProfileDir, 'Default'), {
    recursive: true,
    force: true,
    filter: (source) => !excludedNames.has(path.basename(source))
  });
  fs.writeFileSync(markerPath, JSON.stringify({ sourceEmail: automationProfileEmail, sourceProfileDirectory }, null, 2), 'utf8');
}

function findChromeProfileDirectory(email: string) {
  try {
    const localStatePath = path.join(chromeUserDataDir, 'Local State');
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as {
      profile?: { info_cache?: Record<string, { user_name?: string }> };
    };
    const profiles = Object.entries(localState.profile?.info_cache ?? {});
    return profiles.find(([, profile]) => profile.user_name?.toLowerCase() === email.toLowerCase())?.[0];
  } catch {
    return undefined;
  }
}

function isChromeProfileLockedError(message: string) {
  return /processsingleton|profile.*in use|user data directory is already in use|failed to create.*singleton/i.test(message);
}

function isProfileCopyError(message: string) {
  return /EBUSY|EPERM|resource busy|being used by another process/i.test(message);
}

async function hasTikTokSession(context: BrowserContext) {
  const cookies = await context.cookies('https://www.tiktok.com');
  return cookies.some((cookie) => ['sessionid', 'sessionid_ss', 'sid_guard'].includes(cookie.name) && Boolean(cookie.value));
}

async function readTikTokPostMetrics(page: Page) {
  const embedded = await page.evaluate(() => {
    const metricKeys = ['playCount', 'diggCount', 'commentCount', 'collectCount', 'shareCount'];
    const findStats = (root: unknown) => {
      const queue: unknown[] = [root];
      const seen = new Set<object>();
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== 'object' || seen.has(value)) continue;
        seen.add(value);
        const record = value as Record<string, unknown>;
        const stats = (record.statsV2 ?? record.stats) as Record<string, unknown> | undefined;
        if (stats && metricKeys.some((key) => key in stats)) return stats;
        for (const child of Object.values(record)) if (child && typeof child === 'object') queue.push(child);
      }
      return undefined;
    };
    for (const script of Array.from(document.querySelectorAll('script'))) {
      const text = script.textContent?.trim();
      if (!text || !text.includes('playCount')) continue;
      try {
        const stats = findStats(JSON.parse(text));
        if (stats) return stats;
      } catch {
        // Not every script containing metrics is pure JSON.
      }
    }
    return undefined;
  }).catch(() => undefined);

  const value = (input: unknown) => {
    const parsed = Number(String(input ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  if (embedded) {
    return {
      views: value(embedded.playCount),
      likes: value(embedded.diggCount),
      comments: value(embedded.commentCount),
      saves: value(embedded.collectCount),
      shares: value(embedded.shareCount)
    };
  }

  const readSelector = async (selector: string) => parseCompactMetric(await page.locator(selector).first().textContent().catch(() => ''));
  const likes = await readSelector('[data-e2e="like-count"]');
  const comments = await readSelector('[data-e2e="comment-count"]');
  const saves = await readSelector('[data-e2e="undefined-count"], [data-e2e="collect-count"], [data-e2e="favorite-count"]');
  const shares = await readSelector('[data-e2e="share-count"]');
  if ([likes, comments, saves, shares].every((metric) => metric === undefined)) return undefined;
  return { likes, comments, saves, shares };
}

function parseCompactMetric(text: string | null) {
  const normalized = String(text ?? '').trim().replace(',', '.').toUpperCase();
  const match = normalized.match(/([\d.]+)\s*([KMB]?)/);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;
  const multiplier = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'B' ? 1_000_000_000 : 1;
  return Math.round(number * multiplier);
}

async function openUploadPage(page: Page) {
  let lastError = '';
  for (const url of uploadUrls) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // Waiting for "commit" is enough here. TikTok sometimes reports an
        // HTTP navigation error after the document has already started, even
        // though the login/upload UI remains usable in the browser.
        await page.goto(url, { waitUntil: 'commit', timeout: 60_000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
        return;
      } catch (error) {
        lastError = cleanBrowserError(error instanceof Error ? error.message : String(error));
        await page.waitForTimeout(1500);
      }
    }
  }
  throw new Error(`Không thể mở trang TikTok Upload sau nhiều lần thử. Hãy kiểm tra mạng hoặc mở TikTok trong Chrome để xác nhận trang hoạt động. Chi tiết: ${lastError}`);
}

function cleanBrowserError(message: string) {
  return message
    .replace(/\u001b\[[0-9;]*m/gi, '')
    .replace(/\[[0-9;]*m/gi, '')
    .replace(/\s*Call log:\s*/i, ' ')
    .trim();
}

async function waitForUploadPage(page: Page, fileInput: Locator) {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if (await fileInput.count() && await fileInput.isEnabled().catch(() => false)) return;
    if (!page.url().includes('/upload') && !page.url().includes('/creator-center') && !page.url().includes('/tiktokstudio')) {
      await openUploadPage(page).catch(() => undefined);
    }
    await page.waitForTimeout(1500);
  }
  throw new Error('TikTok login/upload timed out. Complete login or verification in the opened browser and try again.');
}

async function fillCaption(page: Page, caption: string) {
  if (!caption) return;
  const selectors = [
    '[data-e2e="caption-editor"] [contenteditable="true"]',
    '[data-e2e="video-caption"] [contenteditable="true"]',
    '.public-DraftEditor-content[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea[placeholder*="description" i]',
    'textarea[placeholder*="caption" i]',
    '[contenteditable="true"]',
    'textarea'
  ];

  const deadline = Date.now() + 3 * 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const selector of selectors) {
        const candidate = frame.locator(selector).first();
        if (!await candidate.isVisible().catch(() => false)) continue;
        const editable = await candidate.evaluate((element) => {
          const tag = element.tagName.toLowerCase();
          return tag === 'textarea' || tag === 'input' || element.getAttribute('contenteditable') === 'true';
        }).catch(() => false);
        if (!editable) continue;

        try {
          await candidate.click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.keyboard.insertText(caption);
          await page.waitForTimeout(250);
          const currentCaption = await candidate.evaluate((element) => {
            if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
            return element.textContent ?? '';
          });
          if (currentCaption.trim() === caption.trim()) return;
        } catch {
          // Try the next compatible editor while TikTok is still rendering.
        }
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Không tìm thấy ô caption sau 3 phút. TikTok có thể vẫn đang xử lý video hoặc giao diện Upload đã thay đổi.');
}

async function waitForPublishButton(page: Page) {
  const button = page.getByRole('button', { name: /^(Post|Publish|Đăng|Xuất bản)$/i }).last();
  await button.waitFor({ state: 'visible', timeout: 5 * 60_000 });
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    if (await button.isEnabled().catch(() => false)) return button;
    await page.waitForTimeout(1000);
  }
  throw new Error('TikTok did not enable the publish button. Check video processing and required fields.');
}

async function waitForPublishedUrl(page: Page) {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    if (/\/@[^/]+\/video\/\d+/.test(page.url())) return page.url().split('?')[0];
    const link = page.locator('a[href*="/video/"]').first();
    const href = await link.getAttribute('href').catch(() => null);
    if (href) return new URL(href, 'https://www.tiktok.com').toString().split('?')[0];
    await page.waitForTimeout(1500);
  }
  return undefined;
}
