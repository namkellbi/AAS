import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { FetchRequest, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { getConfig } from '@/server/config';
import { scorePost } from '@/server/scoring/trendingScore';

type RawPost = Omit<ThreadsPost, 'trendingScore' | 'affiliateFitScore' | 'opportunityScore' | 'velocityScore' | 'engagementGrowthPercent' | 'emotionalCategory'>;

export async function fetchThreadsPosts(request: FetchRequest): Promise<ThreadsPost[]> {
  const config = getConfig();
  fs.mkdirSync(path.dirname(config.threadsStorageState), { recursive: true });
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });

  const context = await createThreadsContext(true);

  try {
    const page = await context.newPage();
    await page.goto(urlForRequest(request), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptNonBlockingDialogs(page);
    if (await isLoginRequired(page)) throw new Error('Threads login is required. Open Settings and use Threads Login before fetching.');
    await page.waitForTimeout(config.scraperMinDelayMs);
    await page.locator('a[href*="/post/"]').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1200);

    const posts = await collectPosts(page, request, Math.min(request.maxPosts ?? config.scraperMaxPosts, config.scraperMaxPosts));
    await context.storageState({ path: config.threadsStorageState });
    return posts;
  } finally {
    await context.close();
  }
}

async function isLoginRequired(page: Page) {
  if (/\/login(?:\/|$)/i.test(new URL(page.url()).pathname)) return true;
  return page.locator('input[type="password"]').first().isVisible().catch(() => false);
}

export async function openThreadsLoginSession(): Promise<void> {
  const config = getConfig();
  fs.mkdirSync(path.dirname(config.threadsStorageState), { recursive: true });
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });

  const context = await createThreadsContext(false);
  const page = await context.newPage();
  await page.goto('https://www.threads.net/login', { waitUntil: 'domcontentloaded' });
  await page
    .waitForURL((url) => url.hostname.endsWith('threads.net') && !url.pathname.includes('/login'), { timeout: 10 * 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(3000);
  const accountName = await extractAccountNameFromPage(page).catch(() => undefined);
  if (accountName) writeThreadsAccountName(accountName);
  await context.storageState({ path: config.threadsStorageState });
  await context.close();
}

export async function getThreadsLoginStatus() {
  const config = getConfig();
  if (!fs.existsSync(config.threadsStorageState) && !fs.existsSync(config.threadsProfileDir)) {
    return { ok: false, message: 'Threads profile/session is missing. Use Threads Login first.' };
  }

  if (!fs.existsSync(config.threadsStorageState)) {
    return { ok: true, message: 'Threads browser profile exists.' };
  }

  const state = JSON.parse(fs.readFileSync(config.threadsStorageState, 'utf8')) as { cookies?: Array<{ name: string; domain: string }> };
  const hasThreadsCookie = state.cookies?.some((cookie) => cookie.domain.includes('threads.net') || cookie.domain.includes('instagram.com'));
  const accountName = await readThreadsAccountNameFromLiveProfile().catch(() => detectThreadsAccountName());
  return hasThreadsCookie
    ? { ok: true, message: accountName ? `Threads session exists for @${accountName}.` : 'Threads session exists.' }
    : { ok: true, message: 'Threads browser profile exists. Login may still be required.' };
}

export function detectThreadsAccountName(): string | undefined {
  const config = getConfig();
  const saved = readThreadsAccountName();
  if (saved) return saved;

  return undefined;
}

async function readThreadsAccountNameFromLiveProfile() {
  const config = getConfig();
  if (!fs.existsSync(config.threadsProfileDir)) return undefined;

  const context = await createThreadsContext(true);
  try {
    const page = await context.newPage();
    await page.goto('https://www.threads.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);
    const accountName = await extractAccountNameFromPage(page);
    if (accountName) writeThreadsAccountName(accountName);
    await context.storageState({ path: config.threadsStorageState });
    return accountName;
  } finally {
    await context.close();
  }
}

async function extractAccountNameFromPage(page: Page) {
  const profileLink = page.getByRole('link', { name: /profile/i }).first();
  if (await profileLink.isVisible().catch(() => false)) {
    await profileLink.click().catch(() => undefined);
    await page.waitForTimeout(2000);
  }

  return page.evaluate(() => {
    const pathMatch = location.pathname.match(/^\/@([A-Za-z0-9._]+)/);
    if (pathMatch?.[1]) return pathMatch[1];

    const links = Array.from(document.querySelectorAll('a'))
      .map((anchor) => (anchor as HTMLAnchorElement).href)
      .map((href) => href.match(/threads\.(?:com|net)\/@([A-Za-z0-9._]+)/)?.[1])
      .filter(Boolean);
    return links[0];
  });
}

function readThreadsAccountName() {
  const config = getConfig();
  const filePath = path.join(config.threadsProfileDir, 'threads-account.json');
  if (!fs.existsSync(filePath)) return undefined;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { username?: string };
    return data.username ? sanitizeAccountName(data.username) : undefined;
  } catch {
    return undefined;
  }
}

function writeThreadsAccountName(username: string) {
  const config = getConfig();
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });
  fs.writeFileSync(path.join(config.threadsProfileDir, 'threads-account.json'), JSON.stringify({ username: sanitizeAccountName(username) }, null, 2), 'utf8');
}

function sanitizeAccountName(value: string) {
  return value.replace(/^@/, '').trim();
}

async function createThreadsContext(headless: boolean): Promise<BrowserContext> {
  const config = getConfig();
  return chromium.launchPersistentContext(config.threadsProfileDir, {
    headless,
    viewport: { width: headless ? 1440 : 1280, height: headless ? 1100 : 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
  });
}

function urlForRequest(request: FetchRequest) {
  const query = request.query?.trim();
  switch (request.mode) {
    case 'keyword':
      return `https://www.threads.com/search?q=${encodeURIComponent(query ?? '')}`;
    case 'hashtag':
      return `https://www.threads.com/t/${encodeURIComponent((query ?? '').replace(/^#/, ''))}`;
    case 'profile':
      return `https://www.threads.com/@${encodeURIComponent((query ?? '').replace(/^@/, ''))}`;
    case 'trending':
      return 'https://www.threads.com/search?q=people%20with%20always%20struggle';
    case 'home':
    default:
      return 'https://www.threads.com/';
  }
}

async function collectPosts(page: Page, request: FetchRequest, maxPosts: number): Promise<ThreadsPost[]> {
  const collected = new Map<string, ThreadsPost>();

  for (let attempt = 0; attempt < 8 && collected.size < maxPosts; attempt += 1) {
    const rawPosts = await extractVisiblePosts(page, request);

    for (const raw of rawPosts) {
      if (!isUsablePost(raw) || !matchesRequestedKeyword(raw, request) || collected.has(raw.id)) continue;
      const scored = scorePost(raw);
      collected.set(raw.id, {
        ...raw,
        trendingScore: scored.score,
        affiliateFitScore: scored.affiliateFitScore,
        opportunityScore: scored.opportunityScore,
        velocityScore: scored.velocityScore,
        engagementGrowthPercent: scored.engagementGrowthPercent,
        emotionalCategory: scored.emotionalCategory
      });
      if (collected.size >= maxPosts) break;
    }

    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1200);
  }

  return Array.from(collected.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function isUsablePost(post: RawPost) {
  if (!post.content || post.author === 'Unknown author' || !/\/post\/[A-Za-z0-9_-]+/.test(post.url)) return false;
  return !/for younew threadsearchsearchmessagesmessagesnotificationsactivityprofileprofileinsightsinsightssavedsaved/i.test(post.content.replace(/\s+/g, ''));
}

function matchesRequestedKeyword(post: RawPost, request: FetchRequest) {
  if (request.mode !== 'keyword' || !request.query?.trim()) return true;
  const tokens = normalizeSearchText(request.query)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  if (!tokens.length) return true;
  const searchable = normalizeSearchText(`${post.author} ${post.authorHandle ?? ''} ${post.content}`);
  return tokens.some((token) => searchable.includes(token));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

async function extractVisiblePosts(page: Page, request: FetchRequest): Promise<RawPost[]> {
  return page.evaluate(
    ({ mode, query }) => {
      const now = new Date().toISOString();
      const anchorPosts = parsePostAnchors();
      if (anchorPosts.length) return anchorPosts;

      const containers = Array.from(document.querySelectorAll('article, [role="article"], div')).filter((element) => {
        const text = (element.textContent ?? '').trim();
        return text.length > 40 && text.length < 2600 && /like|reply|repost|ago|views?/i.test(text);
      });

      const seen = new Set<string>();

      const domPosts = containers
        .map((container) => {
          const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
          const link = Array.from(container.querySelectorAll('a'))
            .map((anchor) => anchor as HTMLAnchorElement)
            .find((anchor) => /\/post\//.test(anchor.href));
          const handleLink = Array.from(container.querySelectorAll('a'))
            .map((anchor) => anchor as HTMLAnchorElement)
            .find((anchor) => /threads\.net\/@/.test(anchor.href));
          const imgs = extractMediaUrls(container);

          const url = link ? normalizePostUrl(link.href) : location.href;
          const id = stableId(url, text);
          if (seen.has(id)) return null;
          seen.add(id);

          const authorHandle = handleLink ? `@${handleLink.href.split('/@')[1]?.split('/')[0] ?? ''}` : undefined;
          const author = authorHandle ?? 'Unknown author';

          return {
            id,
            author,
            authorHandle,
            content: cleanPostText(text),
            likes: parseMetric(text, ['like', 'likes']),
            replies: parseMetric(text, ['reply', 'replies']),
            reposts: parseMetric(text, ['repost', 'reposts']),
            timestamp: parseTimestamp(text),
            imageUrls: imgs,
            url,
            source: mode,
            keyword: query,
            fetchedAt: now
          };
        })
        .filter(Boolean);

      const textPosts = parseTextFeed();
      return textPosts.length ? textPosts : domPosts;

      function parsePostAnchors() {
        const postAnchors = Array.from(document.querySelectorAll('a'))
          .map((anchor) => anchor as HTMLAnchorElement)
          .filter((anchor) => /threads\.(?:com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(anchor.href));
        const urls = new Set<string>();
        const posts = [];

        for (const anchor of postAnchors) {
          const url = normalizePostUrl(anchor.href);
          if (urls.has(url)) continue;
          urls.add(url);

          const author = url.match(/\/@([A-Za-z0-9._]+)\/post\//)?.[1];
          if (!author) continue;

          const container = findPostContainer(anchor, author);
          if (!container) continue;

          const lines = container.innerText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          const dateIndex = lines.findIndex(isDateLine);
          const translateIndex = findTranslateIndex(lines, Math.max(0, dateIndex + 1), lines.length);
          const contentEnd = translateIndex > -1 ? translateIndex : lines.length;
          const content = lines
            .slice(Math.max(0, dateIndex + 1), contentEnd)
            .filter((line) => !/^more$/i.test(line))
            .join('\n')
            .trim();
          if (content.length < 4) continue;

          const metricLines = translateIndex > -1 ? lines.slice(translateIndex + 1) : [];
          const metrics = metricLines
            .filter((line) => /^\d+(\.\d+)?[KMB]?$/i.test(line))
            .map(compactToNumber)
            .filter((value) => value >= 0)
            .slice(-4);
          const imgs = extractMediaUrls(container);

          posts.push({
            id: stableId(url, content),
            author,
            authorHandle: `@${author}`,
            content: content.slice(0, 900),
            likes: metrics[0] ?? 0,
            replies: metrics[1] ?? 0,
            reposts: metrics[2] ?? 0,
            timestamp: parseTimestamp(lines[dateIndex] ?? ''),
            imageUrls: imgs,
            url,
            source: mode,
            keyword: query,
            fetchedAt: now
          });
        }

        return posts;
      }

      function findPostContainer(anchor: HTMLAnchorElement, author: string) {
        let current: HTMLElement | null = anchor;
        for (let depth = 0; current && depth < 14; depth += 1) {
          const text = current.innerText;
          if (text.length >= 40 && text.length <= 1800 && text.includes(author) && /translate/i.test(text)) return current;
          current = current.parentElement;
        }
        return null;
      }

      function cleanPostText(text: string) {
        return text
          .replace(/\b\d+(\.\d+)?[KMB]?\s+(likes?|replies|reposts?|views?)\b/gi, '')
          .replace(/\b\d+[smhdw]\b/gi, '')
          .replace(/\s+/g, ' ')
          .slice(0, 900)
          .trim();
      }

      function normalizePostUrl(url: string) {
        const match = url.match(/^(https:\/\/(?:www\.)?threads\.(?:com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+)/);
        return match?.[1] ?? url;
      }

      function extractMediaUrls(container: Element) {
        return Array.from(
          new Set(
            Array.from(container.querySelectorAll('img'))
              .map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src)
              .filter((src) => src && !/\/v\/t[^/]+-19\//i.test(src))
          )
        );
      }

      function parseMetric(text: string, labels: string[]) {
        for (const label of labels) {
          const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?\\s*[KMB]?)\\s+${label}`, 'i'));
          if (match) return compactToNumber(match[1]);
        }
        return 0;
      }

      function compactToNumber(value: string) {
        const cleaned = value.replace(/\s+/g, '').toUpperCase();
        const number = Number.parseFloat(cleaned);
        if (!Number.isFinite(number)) return 0;
        if (cleaned.endsWith('B')) return Math.round(number * 1_000_000_000);
        if (cleaned.endsWith('M')) return Math.round(number * 1_000_000);
        if (cleaned.endsWith('K')) return Math.round(number * 1_000);
        return Math.round(number);
      }

      function parseTimestamp(text: string) {
        const absoluteDate = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
        if (absoluteDate) {
          const month = Number(absoluteDate[1]) - 1;
          const day = Number(absoluteDate[2]);
          const year = Number(absoluteDate[3]) + (absoluteDate[3].length === 2 ? 2000 : 0);
          return new Date(year, month, day).toISOString();
        }

        const match = text.match(/\b(\d+)([smhdw])\b/i);
        if (!match) return now;
        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
        return new Date(Date.now() - amount * (multipliers[unit] ?? 0)).toISOString();
      }

      function stableId(url: string, text: string) {
        if (/\/post\//.test(url)) return url.split('/post/')[1] ?? url;
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
          hash = (hash << 5) - hash + text.charCodeAt(i);
          hash |= 0;
        }
        return `threads-${Math.abs(hash)}`;
      }

      function parseTextFeed() {
        const lines = document.body.innerText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const postLinksByAuthor = collectPostLinksByAuthor();
        const dateIndexes = lines.map((line, index) => (isDateLine(line) ? index : -1)).filter((index) => index >= 0);
        const posts = [];

        for (let i = 0; i < dateIndexes.length; i += 1) {
          const dateIndex = dateIndexes[i];
          const nextDateIndex = dateIndexes[i + 1] ?? lines.length;
          const authorIndex = findAuthorIndex(lines, dateIndex);
          if (authorIndex < 0) continue;

          const contentStart = dateIndex + 1;
          const translateIndex = findTranslateIndex(lines, contentStart, nextDateIndex);
          const contentEnd = translateIndex > -1 ? translateIndex : nextDateIndex;
          const content = lines.slice(contentStart, contentEnd).join('\n').trim();
          if (content.length < 12 || isNavigationText(content)) continue;

          const metricLines = translateIndex > -1 ? lines.slice(translateIndex + 1, nextDateIndex) : [];
          const metrics = metricLines
            .filter((line) => /^\d+(\.\d+)?[KMB]?$/i.test(line))
            .map(compactToNumber)
            .filter((value) => value > 0);

          const author = lines[authorIndex];
          if (isReservedLine(author) || /^thread$/i.test(author)) continue;
          const textForId = `${author}|${lines[dateIndex]}|${content}`;
          const postUrl = postLinksByAuthor.get(author)?.shift() ?? location.href;
          const id = stableId(postUrl, textForId);
          if (seen.has(id)) continue;
          seen.add(id);

          posts.push({
            id,
            author,
            authorHandle: `@${author}`,
            content: content.slice(0, 900),
            likes: metrics[0] ?? 0,
            replies: metrics[1] ?? 0,
            reposts: metrics[2] ?? 0,
            timestamp: parseTimestamp(lines[dateIndex]),
            imageUrls: [],
            url: postUrl,
            source: mode,
            keyword: query,
            fetchedAt: now
          });
        }

        return posts;
      }

      function collectPostLinksByAuthor() {
        const links = new Map<string, string[]>();
        const postAnchors = Array.from(document.querySelectorAll('a'))
          .map((anchor) => normalizePostUrl((anchor as HTMLAnchorElement).href))
          .filter((href) => /threads\.(?:com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(href));

        for (const href of postAnchors) {
          const author = href.match(/\/@([A-Za-z0-9._]+)\/post\//)?.[1];
          if (!author) continue;
          const current = links.get(author) ?? [];
          if (!current.includes(href)) current.push(href);
          links.set(author, current);
        }

        return links;
      }

      function isDateLine(line: string) {
        return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line) || /^\d+[smhdw]$/.test(line);
      }

      function findAuthorIndex(lines: string[], dateIndex: number) {
        const candidates = [];
        for (let index = dateIndex - 1; index >= Math.max(0, dateIndex - 3); index -= 1) {
          const line = lines[index];
          if (/^[a-zA-Z0-9._]{2,40}$/.test(line) && !isReservedLine(line)) candidates.push(index);
        }
        if (candidates.length >= 2) {
          const closest = lines[candidates[0]];
          const previous = lines[candidates[1]];
          if ((!/[._\d]/.test(closest) || closest.length <= 5) && /[._\d]/.test(previous)) return candidates[1];
        }
        return candidates[0] ?? -1;
      }

      function findTranslateIndex(lines: string[], start: number, end: number) {
        for (let index = start; index < end; index += 1) {
          if (/^translate$/i.test(lines[index])) return index;
        }
        return -1;
      }

      function isReservedLine(line: string) {
        return /^(top|recent|profiles|search|messages|activity|profile|insights|saved|feeds|edit|following|more|for you|new thread)$/i.test(line);
      }

      function isNavigationText(text: string) {
        return /^(top|recent|profiles|search|messages|activity|profile|insights|saved|feeds|edit|following|more)$/i.test(text);
      }
    },
    { mode: request.mode, query: request.query }
  ) as Promise<RawPost[]>;
}

async function acceptNonBlockingDialogs(page: Page) {
  const labels = ['Allow all cookies', 'Accept all', 'Accept', 'Not now'];
  for (const label of labels) {
    const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }
}
