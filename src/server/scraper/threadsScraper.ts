import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { filterUsefulReplies } from '@/lib/replies';
import { sanitizeThreadsMediaCandidates, sanitizeThreadsPostImageUrls, type ThreadsMediaCandidate } from '@/lib/threadsMedia';
import type { FetchRequest, ThreadsPost, ThreadsReply, TrendState } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { getConfig } from '@/server/config';
import { scorePost } from '@/server/scoring/trendingScore';
import {
  hasThreadsAuthCookie,
  isGenericThreadsContent,
  isGenericThreadsLoginMetadata,
  isInvalidThreadsPostRedirect,
  isThreadsLoginUrl,
  threadsUrlHasPostId,
  type ThreadsCookieLike
} from '@/server/scraper/threadsAccess';

type RawPost = Omit<ThreadsPost, 'trendingScore' | 'affiliateFitScore' | 'opportunityScore' | 'velocityScore' | 'engagementGrowthPercent' | 'emotionalCategory' | 'topReplies' | 'trendState' | 'likesPerHour' | 'repliesPerHour' | 'videoPotentialScore' | 'engagementScore'>;
type RawPostWithMediaCandidates = Omit<RawPost, 'imageUrls'> & { mediaCandidates: ThreadsMediaCandidate[] };

type ThreadsAccessErrorCode = 'login_required' | 'post_unavailable' | 'unexpected_page';

class ThreadsAccessError extends Error {
  constructor(readonly code: ThreadsAccessErrorCode, message: string) {
    super(message);
    this.name = 'ThreadsAccessError';
  }
}

export async function fetchThreadsPosts(request: FetchRequest): Promise<ThreadsPost[]> {
  const config = getConfig();
  fs.mkdirSync(path.dirname(config.threadsStorageState), { recursive: true });
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });

  const context = await createThreadsContext(true);

  try {
    await requireThreadsAuthentication(context, 'fetching Threads posts');
    const page = await context.newPage();
    await page.goto(urlForRequest(request), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptNonBlockingDialogs(page);
    if (await isLoginRequired(page)) throw loginRequiredError('fetching Threads posts');
    await page.waitForTimeout(config.scraperMinDelayMs);
    await page.locator('a[href*="/post/"]').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1200);

    const posts = await collectPosts(page, request, Math.min(request.maxPosts ?? config.scraperMaxPosts, config.scraperMaxPosts));
    await context.storageState({ path: config.threadsStorageState });
    return await attachTopReplies(page, posts);
  } finally {
    await context.close();
  }
}

export async function fetchThreadsPostByUrl(postUrl: string): Promise<ThreadsPost> {
  const config = getConfig();
  const normalizedUrl = normalizeThreadsPostUrl(postUrl);
  const postId = normalizedUrl.split('/post/')[1];
  fs.mkdirSync(path.dirname(config.threadsStorageState), { recursive: true });
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });

  const context = await createThreadsContext(true);

  try {
    await requireThreadsAuthentication(context, 'importing a Threads post');
    const page = await context.newPage();
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptNonBlockingDialogs(page);
    if (await isLoginRequired(page)) throw loginRequiredError('importing a Threads post');
    await page.waitForTimeout(config.scraperMinDelayMs);
    await page.locator(`a[href*="/post/${postId}"]`).first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    await assertExpectedThreadsPostPage(page, normalizedUrl);

    const request: FetchRequest = { mode: 'manual', query: normalizedUrl, maxPosts: 1 };
    const rawPosts = await extractVisiblePosts(page, request);
    const visiblePost = rawPosts.find((post) => isSameThreadsPostUrl(post.url, normalizedUrl) || post.id === postId);
    const permalinkPost = await extractPermalinkPost(page, normalizedUrl);
    const metadataPost = permalinkPost || visiblePost ? null : await extractMetadataPost(page, normalizedUrl);
    const rawPost = permalinkPost ?? visiblePost ?? metadataPost;
    if (!rawPost || !isUsablePost(rawPost)) {
      const diagnostic = await page.evaluate(() => ({
        title: document.title,
        postLinks: document.querySelectorAll('a[href*="/post/"]').length,
        pressableContainers: document.querySelectorAll('[data-pressable-container="true"]').length,
        bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 500)
      })).catch(() => ({ title: '', postLinks: 0, pressableContainers: 0, bodyText: '' }));
      throw new Error(
        `Could not read this Threads post. URL=${page.url()} title=${JSON.stringify(diagnostic.title)} `
        + `postLinks=${diagnostic.postLinks} containers=${diagnostic.pressableContainers} `
        + `visibleText=${JSON.stringify(diagnostic.bodyText)}`
      );
    }

    let fetchedReplies: ThreadsReply[] = [];
    try {
      fetchedReplies = await fetchTopReplies(page, normalizedUrl, rawPost);
    } catch (error) {
      if (error instanceof ThreadsAccessError) throw error;
    }
    const topReplies = filterUsefulReplies(fetchedReplies, rawPost);
    await context.storageState({ path: config.threadsStorageState });
    return scoreRawPost({
      ...rawPost,
      id: postId,
      imageUrls: sanitizeThreadsPostImageUrls(rawPost.imageUrls),
      url: normalizedUrl,
      source: 'manual',
      keyword: undefined
    }, topReplies);
  } finally {
    await context.close();
  }
}

async function extractMetadataPost(page: Page, postUrl: string): Promise<RawPost | null> {
  const metadata = await page.evaluate(() => {
    const description = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim()
      || document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim();
    const title = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim() ?? '';
    const imageUrls = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]'))
      .map((meta) => meta.content?.trim())
      .filter((url): url is string => Boolean(url));
    const canonicalUrls = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'))
      .map((link) => link.href?.trim())
      .concat(
        Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]'))
          .map((meta) => meta.content?.trim())
      )
      .filter((url): url is string => Boolean(url));
    return { description: description ?? '', title, imageUrls, canonicalUrls };
  });

  const postId = postUrl.split('/post/')[1]?.split(/[?#]/)[0];
  const handle = postUrl.match(/\/@([A-Za-z0-9._]+)\/post\//)?.[1];
  if (!postId || !handle || !metadata.description) return null;
  if (!metadata.canonicalUrls.some((url) => threadsUrlHasPostId(url, postId))) return null;
  if (isGenericThreadsLoginMetadata(metadata.title, metadata.description)) return null;

  const displayName = metadata.title.match(/^(.*?)\s*\(@[^)]+\)\s+on Threads$/i)?.[1]?.trim();
  const timestamp = nowIso();
  return {
    id: postId,
    author: displayName || handle,
    authorHandle: `@${handle}`,
    content: metadata.description.slice(0, 900),
    likes: 0,
    replies: 0,
    reposts: 0,
    timestamp,
    imageUrls: sanitizeThreadsMediaCandidates(
      metadata.imageUrls.map((url) => ({ url, kind: 'metadata' }))
    ),
    url: postUrl,
    source: 'manual',
    fetchedAt: timestamp
  };
}

async function isLoginRequired(page: Page) {
  if (isThreadsLoginUrl(page.url())) return true;
  return page.locator('input[type="password"]').first().isVisible().catch(() => false);
}

export async function openThreadsLoginSession(): Promise<void> {
  const config = getConfig();
  fs.mkdirSync(path.dirname(config.threadsStorageState), { recursive: true });
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });
  clearThreadsAccountName();

  const context = await createThreadsContext(false);
  try {
    // Clicking Threads Login always starts a fresh authentication attempt.
    // This also removes a server-revoked sessionid that may not be expired in
    // the local cookie database yet.
    await context.clearCookies({ name: /^sessionid$/i });
    await context.storageState({ path: config.threadsStorageState });
    const loginPage = await context.newPage();
    await loginPage.goto('https://www.threads.com/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForThreadsAuthentication(context, 10 * 60_000);

    const page = loginPage.isClosed() ? await context.newPage() : loginPage;
    await page.goto('https://www.threads.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
    if (await isLoginRequired(page)) throw loginRequiredError('saving the Threads login');

    const accountName = await extractAccountNameFromPage(page).catch(() => undefined);
    if (accountName) writeThreadsAccountName(accountName);
    await context.storageState({ path: config.threadsStorageState });
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function getThreadsLoginStatus() {
  const config = getConfig();
  if (!fs.existsSync(config.threadsStorageState)) {
    clearThreadsAccountName();
    return { ok: false, message: 'Threads profile/session is missing. Use Threads Login first.' };
  }

  if (!hasStoredThreadsAuthSession()) {
    clearThreadsAccountName();
    return { ok: false, message: 'Threads session is expired or logged out. Use Threads Login again.' };
  }

  const accountName = detectThreadsAccountName();
  return {
    ok: true,
    message: accountName ? `Threads session is authenticated for @${accountName}.` : 'Threads session is authenticated.'
  };
}

export function hasStoredThreadsAuthSession() {
  const config = getConfig();
  if (!fs.existsSync(config.threadsStorageState)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(config.threadsStorageState, 'utf8')) as { cookies?: ThreadsCookieLike[] };
    return hasThreadsAuthCookie(state.cookies ?? []);
  } catch {
    return false;
  }
}

export function detectThreadsAccountName(): string | undefined {
  if (!hasStoredThreadsAuthSession()) return undefined;
  const saved = readThreadsAccountName();
  if (saved) return saved;

  return undefined;
}

async function extractAccountNameFromPage(page: Page) {
  const accountFromLink = await page.waitForFunction(() => {
    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const labels = [
        anchor.getAttribute('aria-label') ?? '',
        anchor.textContent ?? '',
        ...Array.from(anchor.querySelectorAll<HTMLElement>('[aria-label]')).map((element) => element.getAttribute('aria-label') ?? '')
      ];
      const normalizedLabel = labels
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '');
      // Threads can expose the same accessible label on nested elements,
      // producing values such as "ProfileProfile" in textContent.
      if (!/^(?:profile)+$/.test(normalizedLabel) && !/^(?:trangcanhan)+$/.test(normalizedLabel)) continue;
      const match = new URL(anchor.href, location.href).pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);
      if (match?.[1]) return match[1];
    }
    return false;
  }, undefined, { timeout: 15_000 }).then((handle) => handle.jsonValue() as Promise<string>).catch(() => undefined);
  if (accountFromLink) return accountFromLink;

  const profileControl = page
    .getByRole('button', { name: /^(?:profile|trang cá nhân)$/i })
    .or(page.getByRole('link', { name: /^(?:profile|trang cá nhân)$/i }))
    .first();
  if (await profileControl.isVisible().catch(() => false)) {
    await profileControl.click();
    await page.waitForURL((url) => /^\/@[A-Za-z0-9._]+\/?$/.test(url.pathname), { timeout: 15_000 });
  }

  return page.evaluate(() => location.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/)?.[1]);
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
  const sanitized = sanitizeAccountName(username);
  if (!/^[A-Za-z0-9._]+$/.test(sanitized)) return;
  fs.mkdirSync(config.threadsProfileDir, { recursive: true });
  fs.writeFileSync(path.join(config.threadsProfileDir, 'threads-account.json'), JSON.stringify({ username: sanitized }, null, 2), 'utf8');
}

function clearThreadsAccountName() {
  const config = getConfig();
  const filePath = path.join(config.threadsProfileDir, 'threads-account.json');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function sanitizeAccountName(value: string) {
  return value.replace(/^@/, '').trim();
}

async function createThreadsContext(headless: boolean): Promise<BrowserContext> {
  const config = getConfig();
  return chromium.launchPersistentContext(config.threadsProfileDir, {
    headless,
    viewport: { width: headless ? 1440 : 1280, height: headless ? 1100 : 900 }
  });
}

async function requireThreadsAuthentication(context: BrowserContext, action: string) {
  const cookies = await context.cookies();
  if (!hasThreadsAuthCookie(cookies)) throw loginRequiredError(action);
}

function loginRequiredError(action: string) {
  return new ThreadsAccessError(
    'login_required',
    `Threads session is expired or logged out while ${action}. Open Settings and use Threads Login again.`
  );
}

async function waitForThreadsAuthentication(context: BrowserContext, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (hasThreadsAuthCookie(await context.cookies())) return;
      if (!context.pages().length) {
        throw new ThreadsAccessError('login_required', 'Threads login was cancelled before authentication completed.');
      }
    } catch (error) {
      if (error instanceof ThreadsAccessError) throw error;
      throw new ThreadsAccessError('login_required', 'Threads login was closed before authentication completed.');
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new ThreadsAccessError(
    'login_required',
    'Threads login timed out. Complete the login in the browser window and try again.'
  );
}

async function assertExpectedThreadsPostPage(page: Page, expectedPostUrl: string) {
  const postId = expectedPostUrl.split('/post/')[1]?.split(/[?#]/)[0];
  if (!postId) throw new ThreadsAccessError('unexpected_page', 'The Threads post URL is missing a post ID.');
  if (await isLoginRequired(page)) throw loginRequiredError('opening this Threads post');

  const snapshot = await page.evaluate((expectedId) => ({
    url: location.href,
    title: document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim() || document.title,
    description: document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim()
      || document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim()
      || '',
    canonicalUrls: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'))
      .map((link) => link.href)
      .concat(Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]')).map((meta) => meta.content))
      .filter(Boolean),
    targetLinkCount: Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'))
      .filter((anchor) => anchor.href.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1] === expectedId)
      .length
  }), postId);

  const currentUrlMatches = threadsUrlHasPostId(snapshot.url, postId);
  const canonicalMatches = snapshot.canonicalUrls.some((url) => threadsUrlHasPostId(url, postId));
  if (currentUrlMatches || canonicalMatches) return;

  if (isInvalidThreadsPostRedirect(snapshot.url) || isGenericThreadsLoginMetadata(snapshot.title, snapshot.description)) {
    throw new ThreadsAccessError(
      'post_unavailable',
      'Threads could not open this post. The saved session may have expired, or the post is unavailable/restricted. Check Threads Session and log in again.'
    );
  }

  throw new ThreadsAccessError(
    'unexpected_page',
    `Threads opened a different page instead of post ${postId}. Final URL=${snapshot.url} targetLinks=${snapshot.targetLinkCount}.`
  );
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
    case 'manual':
      return normalizeThreadsPostUrl(query ?? '');
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
      collected.set(raw.id, scoreRawPost(raw));
      if (collected.size >= maxPosts) break;
    }

    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1200);
  }

  return Array.from(collected.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function scoreRawPost(raw: RawPost, topReplies: ThreadsReply[] = []): ThreadsPost {
  const enrichedRaw = {
    ...raw,
    topReplies,
    trendState: initialTrendState(raw.timestamp),
    likesPerHour: 0,
    repliesPerHour: 0,
    videoPotentialScore: 0
  };
  const scored = scorePost(enrichedRaw);
  return {
    ...enrichedRaw,
    trendingScore: scored.score,
    affiliateFitScore: scored.affiliateFitScore,
    opportunityScore: scored.opportunityScore,
    velocityScore: scored.velocityScore,
    engagementGrowthPercent: scored.engagementGrowthPercent,
    emotionalCategory: scored.emotionalCategory,
    videoPotentialScore: scored.videoPotentialScore,
    engagementScore: scored.engagementScore
  };
}

async function attachTopReplies(page: Page, posts: ThreadsPost[]) {
  const candidates = posts.filter((post) => post.replies >= 10).slice(0, 8);
  const replyMap = new Map<string, ThreadsReply[]>();
  for (const post of candidates) {
    let replies: ThreadsReply[] = [];
    try {
      replies = await fetchTopReplies(page, post.url, post);
    } catch (error) {
      if (error instanceof ThreadsAccessError) throw error;
    }
    replyMap.set(post.id, replies);
    await page.waitForTimeout(650);
  }

  return posts.map((post) => {
    const refreshed = replyMap.get(post.id);
    const topReplies = filterUsefulReplies(refreshed?.length ? refreshed : post.topReplies, post);
    const next = { ...post, topReplies };
    const score = scorePost(next);
    return { ...next, trendingScore: score.score, affiliateFitScore: score.affiliateFitScore, opportunityScore: score.opportunityScore, velocityScore: score.velocityScore, emotionalCategory: score.emotionalCategory, videoPotentialScore: score.videoPotentialScore, engagementScore: score.engagementScore };
  });
}

async function fetchTopReplies(
  page: Page,
  postUrl: string,
  context?: Pick<ThreadsPost, 'author' | 'authorHandle' | 'content'>
): Promise<ThreadsReply[]> {
  await requireThreadsAuthentication(page.context(), 'fetching Threads replies');
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (await isLoginRequired(page)) throw loginRequiredError('fetching Threads replies');
  // Threads hydrates the permalink and its ranked replies asynchronously.
  // Reading or scrolling too early can switch us onto a partially loaded
  // nested reply branch instead of the visible Top replies.
  await page.waitForTimeout(5000);
  await assertExpectedThreadsPostPage(page, postUrl);
  const rootId = postUrl.split('/post/')[1]?.split(/[?#]/)[0] ?? '';
  const rootPermalinkExists = await page.locator(`a[href*="/post/${rootId}"]`).count().then((count) => count > 0);
  if (!rootPermalinkExists) return [];

  const collectVisibleReplies = () => page.evaluate((rootUrl) => {
    const rootId = rootUrl.split('/post/')[1]?.split(/[?#]/)[0] ?? '';
    const anchors = Array.from(document.querySelectorAll('a'))
      .map((anchor) => anchor as HTMLAnchorElement)
      .filter((anchor) => /\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(anchor.href));
    const rootAuthor = rootUrl.match(/\/@([A-Za-z0-9._]+)\/post\//)?.[1]?.toLocaleLowerCase() ?? '';
    const rootTimestamp = anchors
      .find((anchor) => anchor.href.includes(`/post/${rootId}`) && anchor.querySelector('time[datetime]'))
      ?.querySelector('time[datetime]')?.getAttribute('datetime');
    const seen = new Set<string>();
    const replies: ThreadsReply[] = [];
    const threadContinuations: ThreadsReply[] = [];

    for (const anchor of anchors) {
      const match = anchor.href.match(/\/@([A-Za-z0-9._]+)\/post\/([A-Za-z0-9_-]+)/);
      if (!match || match[2] === rootId || seen.has(match[2])) continue;
      // `data-pressable-container` is not a stable card boundary on Threads:
      // it may point to an action wrapper or the entire conversation. Walk up
      // from the reply permalink and take the smallest ancestor that contains
      // the reply text plus its own Like control.
      let container: HTMLElement | null = null;
      const pressable = anchor.closest<HTMLElement>('[data-pressable-container="true"]');
      if (pressable) {
        const directPermalink = Array.from(pressable.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'))
          .find((candidate) => candidate.querySelector('time[datetime]'));
        const directPostId = directPermalink?.href.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1];
        const text = pressable.innerText?.trim() ?? '';
        if (directPostId === match[2] && text.length >= 20 && text.length <= 2500) container = pressable;
      }
      let current: HTMLElement | null = anchor;
      for (let depth = 0; !container && current && depth < 14; depth += 1) {
        const text = current.innerText?.trim() ?? '';
        if (text.length >= 20 && text.length <= 2500 && current.querySelector('svg[aria-label="Like"]')) {
          container = current;
          break;
        }
        current = current.parentElement;
      }
      if (!container) continue;
      // A quoted/embedded Threads card has its own permalink inside the direct
      // reply. Its anchor must not be promoted to a top-level reply.
      // Keep only the direct reply's text. Otherwise an outer reply containing
      // a quote card inherits all text/metrics from the embedded post.
      const lines = directReplyText(container)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const timestampIndex = lines.findIndex(isTimestampLine);
      const contentStart = timestampIndex >= 0 ? timestampIndex + 1 : 1;
      const translateIndex = lines.findIndex((line, index) => index >= contentStart && /^(translate|dịch)$/i.test(line));
      const metricStart = lines.findIndex((line, index) => index > contentStart && isMetricLine(line));
      const contentEnd = translateIndex > contentStart ? translateIndex : metricStart > contentStart ? metricStart : lines.length;
      const content = lines
        .slice(contentStart, contentEnd)
        .filter((line) => !isTimestampLine(line) && !isMetricLine(line) && !isAuthorLabel(line) && !/^(more|xem thêm|translate|dịch)$/i.test(line) && line !== match[1])
        .join(' ')
        .replace(
          /\s*(?:(?:translate|dịch)\s*)?like(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*comments?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*reposts?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*shares?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*$/iu,
          ''
        )
        .replace(/^\s*[·•.]\s*(?:author|tác\s+giả)\s*[:·•.\-–—]?\s*/iu, '')
        .trim();
      if (!isUsefulContent(content)) continue;
      // Capture the segment badge before truncating long reply content. These
      // optional fields survive persistence inside the top_replies JSON.
      const segmentMatch = content.match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})\s*[.)\]]?\s*$/u);
      const segmentIndex = segmentMatch ? Number(segmentMatch[1]) : undefined;
      const segmentTotal = segmentMatch ? Number(segmentMatch[2]) : undefined;
      const hasValidSegment = Number.isInteger(segmentIndex)
        && Number.isInteger(segmentTotal)
        && segmentIndex! >= 1
        && segmentTotal! >= 2
        && segmentIndex! <= segmentTotal!
        && segmentTotal! <= 99;
      const lineMetrics = lines.slice(contentEnd).filter(isMetricLine).map(compactToNumber);
      const likes = Math.max(interactionMetric(container, ['like', 'thich']) ?? 0, lineMetrics[0] ?? 0);
      const replyCount = maxMetric(interactionMetric(container, ['reply', 'comment', 'tra loi', 'binh luan']), lineMetrics[1]);
      const reposts = maxMetric(interactionMetric(container, ['repost', 'dang lai']), lineMetrics[2]);
      const shares = maxMetric(interactionMetric(container, ['share', 'send', 'chia se', 'gui']), lineMetrics[3]);
      const authorAvatarUrl = findAuthorAvatar(container, match[1]);
      const mediaUrls = findReplyMedia(container, authorAvatarUrl);
      const replyTimestamp = container.querySelector('time[datetime]')?.getAttribute('datetime');
      const isThreadContinuation = Boolean(
        rootTimestamp
          && replyTimestamp === rootTimestamp
          && match[1].toLocaleLowerCase() === rootAuthor
      );
      seen.add(match[2]);
      const reply: ThreadsReply = {
        id: match[2],
        author: match[1],
        ...(authorAvatarUrl ? { authorAvatarUrl } : {}),
        ...(mediaUrls.length ? { mediaUrls } : {}),
        content: content.slice(0, 500),
        likes,
        ...(hasValidSegment ? { segmentIndex, segmentTotal } : {}),
        ...(replyCount === undefined ? {} : { replies: replyCount }),
        ...(reposts === undefined ? {} : { reposts }),
        ...(shares === undefined ? {} : { shares })
      };
      replies.push(reply);
      if (isThreadContinuation) threadContinuations.push(reply);
      if (replies.length >= 20) break;
    }

    // Threads can render the 1/N badge visually without exposing it through
    // textContent/innerText. Self-thread posts do share the root's exact
    // timestamp, however, while ordinary replies have their own timestamp.
    // Their DOM order is the intended reading order.
    const inferredTotal = threadContinuations.length + 1;
    threadContinuations.forEach((reply, index) => {
      reply.segmentIndex ??= index + 2;
      reply.segmentTotal ??= inferredTotal;
    });
    return replies;

    function findAuthorAvatar(container: HTMLElement, author: string) {
      const images = Array.from(container.querySelectorAll('img[src]')) as HTMLImageElement[];
      const expectedAlt = `${author.toLocaleLowerCase()}'s profile picture`;
      const image = images.find((candidate) => (candidate.alt ?? '').toLocaleLowerCase() === expectedAlt)
        ?? images.find((candidate) => {
          const alt = (candidate.alt ?? '').toLocaleLowerCase();
          return alt.includes(author.toLocaleLowerCase()) && alt.includes('profile picture') && candidate.width >= 30;
        })
        ?? images.find((candidate) => (candidate.alt ?? '').toLocaleLowerCase().includes('profile picture') && candidate.width >= 30 && candidate.width <= 80);
      return image?.currentSrc || image?.src || undefined;
    }

    function findReplyMedia(container: HTMLElement, avatarUrl?: string) {
      const urls: string[] = [];
      for (const image of Array.from(container.querySelectorAll<HTMLImageElement>('img[src]'))) {
        const url = image.currentSrc || image.src;
        const alt = (image.alt ?? '').toLocaleLowerCase();
        const width = Math.max(image.naturalWidth || 0, image.getBoundingClientRect().width);
        const height = Math.max(image.naturalHeight || 0, image.getBoundingClientRect().height);
        if (!url || url === avatarUrl || alt.includes('profile picture') || width < 140 || height < 100) continue;
        urls.push(url);
      }
      for (const video of Array.from(container.querySelectorAll<HTMLVideoElement>('video'))) {
        if (video.poster) urls.push(video.poster);
      }
      return Array.from(new Set(urls)).slice(0, 4);
    }

    function directReplyText(container: HTMLElement) {
      return container.innerText ?? container.textContent ?? '';
    }

    function maxMetric(left?: number, right?: number) {
      if (left === undefined) return right;
      if (right === undefined) return left;
      return Math.max(left, right);
    }

    function interactionMetric(container: HTMLElement, labels: string[]) {
      const icon = Array.from(container.querySelectorAll('svg[aria-label]')).find((candidate) => {
        const label = normalizeLabel(candidate.getAttribute('aria-label') ?? '');
        return labels.some((expected) => label.includes(expected));
      });
      if (!icon) return undefined;
      const buttonText = icon.closest('[role="button"]')?.textContent ?? '';
      return firstCompactNumber(`${buttonText} ${icon.getAttribute('aria-label') ?? ''}`);
    }

    function normalizeLabel(value: string) {
      return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .toLowerCase();
    }

    function compactToNumber(value: string) {
      const cleaned = value.replace(/\s+/g, '').toUpperCase();
      if (!/^\d+(?:[.,]\d+)?[KMB]?$/.test(cleaned)) return -1;
      const suffix = cleaned.match(/[KMB]$/)?.[0];
      const numericPart = suffix ? cleaned.slice(0, -1).replace(',', '.') : cleaned.replace(/[.,](?=\d{3}$)/, '');
      const number = Number.parseFloat(numericPart);
      if (suffix === 'B') return Math.round(number * 1_000_000_000);
      if (suffix === 'M') return Math.round(number * 1_000_000);
      if (suffix === 'K') return Math.round(number * 1_000);
      return Math.round(number);
    }

    function firstCompactNumber(value: string) {
      const match = value.match(/\d+(?:[.,]\d+)?\s*[KMB]?/i);
      return match ? Math.max(compactToNumber(match[0]), 0) : 0;
    }

    function isTimestampLine(value: string) {
      return /^\d+[smhdw]$/i.test(value)
        || /^\d+\s*(?:giây|phút|giờ|ngày|tuần|tháng|năm)$/iu.test(value)
        || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value);
    }

    function isMetricLine(value: string) {
      return /^\d+(?:\.\d+)?\s*[KMB]?$/i.test(value);
    }

    function isAuthorLabel(value: string) {
      if (/^(?:\u00b7|\u2022|\.)$/u.test(value.trim())) return true;
      return /^(?:author|tác\s+giả)$/iu.test(value) || /^[·•.]\s*(?:author|tác\s+giả)$/iu.test(value);
    }

    function isUsefulContent(value: string) {
      return value.length >= 3 && !isTimestampLine(value) && !isMetricLine(value);
    }
  }, postUrl);

  const collected = new Map<string, ThreadsReply>();
  let unchangedPasses = 0;
  for (let pass = 0; pass < 6 && collected.size < 20; pass += 1) {
    const previousSize = collected.size;
    for (const reply of await collectVisibleReplies()) {
      const existing = collected.get(reply.id);
      collected.set(reply.id, existing ? {
        ...existing,
        ...reply,
        likes: Math.max(existing.likes, reply.likes),
        replies: maxKnownMetric(existing.replies, reply.replies),
        reposts: maxKnownMetric(existing.reposts, reply.reposts),
        shares: maxKnownMetric(existing.shares, reply.shares),
        mediaUrls: Array.from(new Set([...(existing.mediaUrls ?? []), ...(reply.mediaUrls ?? [])])).slice(0, 4)
      } : reply);
    }
    unchangedPasses = collected.size === previousSize ? unchangedPasses + 1 : 0;
    if (unchangedPasses >= 2) break;
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(450);
  }
  const sorted = filterUsefulReplies(Array.from(collected.values()), context).slice(0, 20);
  return await embedReplyAvatars(page, sorted);

  function maxKnownMetric(left?: number, right?: number) {
    if (left === undefined) return right;
    if (right === undefined) return left;
    return Math.max(left, right);
  }
}

async function embedReplyAvatars(page: Page, replies: ThreadsReply[]): Promise<ThreadsReply[]> {
  const cache = new Map<string, Promise<string | undefined>>();
  const embedUrl = (url: string, maximumBytes: number) => {
    if (url.startsWith('data:')) return Promise.resolve(url);
    let embedded = cache.get(url);
    if (!embedded) {
      embedded = (async () => {
        try {
          const response = await page.context().request.get(url, {
            headers: { Referer: 'https://www.threads.com/' },
            timeout: 15_000
          });
          if (!response.ok()) return undefined;
          const body = await response.body();
          if (!body.length || body.length > maximumBytes) return undefined;
          const contentType = response.headers()['content-type']?.split(';')[0] || 'image/jpeg';
          if (!contentType.startsWith('image/')) return undefined;
          return `data:${contentType};base64,${body.toString('base64')}`;
        } catch {
          return undefined;
        }
      })();
      cache.set(url, embedded);
    }
    return embedded;
  };
  return Promise.all(replies.map(async (reply) => {
    const avatar = reply.authorAvatarUrl ? await embedUrl(reply.authorAvatarUrl, 500_000) : undefined;
    const media = (await Promise.all((reply.mediaUrls ?? []).slice(0, 2).map((url) => embedUrl(url, 8_000_000))))
      .filter((url): url is string => Boolean(url));
    return {
      ...reply,
      ...(avatar ? { authorAvatarUrl: avatar } : {}),
      ...(media.length ? { mediaUrls: media } : {})
    };
  }));
}

export async function scrapeThreadsPostReplies(
  postUrl: string,
  threadContext?: Pick<ThreadsPost, 'author' | 'authorHandle' | 'content'>
): Promise<ThreadsReply[]> {
  const browserContext = await createThreadsContext(true);
  try {
    await requireThreadsAuthentication(browserContext, 'fetching Threads replies');
    const page = await browserContext.newPage();
    return await fetchTopReplies(page, postUrl, threadContext);
  } finally {
    await browserContext.close();
  }
}

export function normalizeThreadsPostUrl(value: string) {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Paste a valid Threads post link.');
  }

  if (!/^(?:www\.)?threads\.(?:com|net)$/i.test(parsed.hostname)) {
    throw new Error('Only Threads post links are supported.');
  }

  const match = parsed.pathname.match(/^\/(@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Paste a Threads post permalink, for example https://www.threads.com/@account/post/ABC123.');
  return `https://www.threads.com/${match[1]}`;
}

function isSameThreadsPostUrl(left: string, right: string) {
  try {
    return normalizeThreadsPostUrl(left) === normalizeThreadsPostUrl(right);
  } catch {
    return false;
  }
}

function initialTrendState(timestamp: string): TrendState {
  const ageHours = Math.max((Date.now() - new Date(timestamp).getTime()) / 36e5, 0);
  return ageHours > 72 ? 'DEAD' : 'EMERGING';
}

function isUsablePost(post: RawPost) {
  if (!post.content || post.author === 'Unknown author' || !threadsUrlHasPostId(post.url, post.id)) return false;
  if (isGenericThreadsContent(post.content)) return false;
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
  const posts = await page.evaluate(
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
            .find((anchor) => /threads\.(?:com|net)\/@/.test(anchor.href));
          const mediaCandidates = extractMediaCandidates(container);

          if (!link) return null;
          const url = normalizePostUrl(link.href);
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
            mediaCandidates,
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
          urls.add(url);

          const metricLines = translateIndex > -1 ? lines.slice(translateIndex + 1) : [];
          const metrics = metricLines
            .filter((line) => /^\d+(?:[.,]\d+)?[KMB]?$/i.test(line))
            .map(compactToNumber)
            .filter((value) => value >= 0)
            .slice(-4);
          const mediaCandidates = extractMediaCandidates(container);

          posts.push({
            id: stableId(url, content),
            author,
            authorHandle: `@${author}`,
            content: content.slice(0, 900),
            likes: metrics[0] ?? 0,
            replies: metrics[1] ?? 0,
            reposts: metrics[2] ?? 0,
            timestamp: parseTimestamp(lines[dateIndex] ?? ''),
            mediaCandidates,
            url,
            source: mode,
            keyword: query,
            fetchedAt: now
          });
        }

        return posts;
      }

      function findPostContainer(anchor: HTMLAnchorElement, author: string) {
        const pressable = anchor.closest<HTMLElement>('[data-pressable-container="true"], article, [role="article"]');
        if (pressable && pressable.innerText.length >= 40 && pressable.innerText.includes(author)) return pressable;

        let current: HTMLElement | null = anchor;
        for (let depth = 0; current && depth < 14; depth += 1) {
          const text = current.innerText;
          const hasPostTime = text.split('\n').some((line) => isDateLine(line.trim()));
          if (text.length >= 40 && text.length <= 2600 && text.includes(author) && hasPostTime) return current;
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

      function extractMediaCandidates(container: Element) {
        const candidates: Array<{
          url: string;
          kind: 'image' | 'video-poster';
          alt?: string;
          renderedWidth?: number;
          renderedHeight?: number;
        }> = [];
        for (const image of Array.from(container.querySelectorAll<HTMLImageElement>('img[src], img[srcset]'))) {
          const url = image.currentSrc || image.src;
          if (!url) continue;
          const rect = image.getBoundingClientRect();
          candidates.push({
            url,
            kind: 'image',
            alt: image.alt ?? '',
            renderedWidth: rect.width,
            renderedHeight: rect.height
          });
        }
        for (const video of Array.from(container.querySelectorAll<HTMLVideoElement>('video[poster]'))) {
          if (video.poster) candidates.push({ url: video.poster, kind: 'video-poster' });
        }
        return candidates;
      }

      function parseMetric(text: string, labels: string[]) {
        for (const label of labels) {
          const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?\\s*[KMB]?)\\s+${label}`, 'i'));
          if (match) return compactToNumber(match[1]);
        }
        return 0;
      }

      function compactToNumber(value: string) {
        const cleaned = value.replace(/\s+/g, '').replace(',', '.').toUpperCase();
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
          const day = Number(absoluteDate[1]);
          const month = Number(absoluteDate[2]) - 1;
          const year = Number(absoluteDate[3]) + (absoluteDate[3].length === 2 ? 2000 : 0);
          return new Date(year, month, day).toISOString();
        }

        const match = text.trim().match(/^(\d+)\s*(s|sec(?:ond)?s?|giây|m|min(?:ute)?s?|phút|h|hr|hours?|giờ|d|days?|ngày|w|weeks?|tuần)$/i);
        if (!match) return now;
        const amount = Number(match[1]);
        const unit = normalizeRelativeUnit(match[2]);
        const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
        return new Date(Date.now() - amount * multipliers[unit]).toISOString();
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
            .filter((line) => /^\d+(?:[.,]\d+)?[KMB]?$/i.test(line))
            .map(compactToNumber)
            .filter((value) => value > 0);

          const author = lines[authorIndex];
          if (isReservedLine(author) || /^thread$/i.test(author)) continue;
          const textForId = `${author}|${lines[dateIndex]}|${content}`;
          const postUrl = postLinksByAuthor.get(author)?.shift();
          if (!postUrl) continue;
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
            mediaCandidates: [],
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
        return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)
          || /^\d+\s*(?:s|sec(?:ond)?s?|giây|m|min(?:ute)?s?|phút|h|hr|hours?|giờ|d|days?|ngày|w|weeks?|tuần)$/i.test(line);
      }

      function normalizeRelativeUnit(unit: string) {
        const normalized = unit.toLocaleLowerCase('vi');
        if (/^(?:s|sec|second|giây)/.test(normalized)) return 's';
        if (/^(?:m|min|minute|phút)/.test(normalized)) return 'm';
        if (/^(?:h|hr|hour|giờ)/.test(normalized)) return 'h';
        if (/^(?:d|day|ngày)/.test(normalized)) return 'd';
        return 'w';
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
          if (/^(?:translate|see translation|dịch|xem bản dịch)$/i.test(lines[index])) return index;
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
  ) as RawPostWithMediaCandidates[];

  return posts.map(({ mediaCandidates, ...post }) => ({
    ...post,
    imageUrls: sanitizeThreadsMediaCandidates(mediaCandidates)
  }));
}

async function extractPermalinkPost(page: Page, postUrl: string): Promise<RawPost | null> {
  const post = await page.evaluate((rootUrl) => {
    const now = new Date().toISOString();
    const postId = rootUrl.split('/post/')[1]?.split(/[?#]/)[0];
    const author = rootUrl.match(/\/@([A-Za-z0-9._]+)\/post\//)?.[1];
    if (!postId || !author) return null;

    const permalinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'))
      .filter((anchor) => anchor.href.includes(`/post/${postId}`));
    let container: HTMLElement | null = null;
    for (const permalink of permalinks) {
      const pressable = permalink.closest<HTMLElement>('[data-pressable-container="true"]');
      if (pressable) {
        const pressablePostIds = new Set(
          Array.from(pressable.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'))
            .map((anchor) => anchor.href.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1])
            .filter(Boolean)
        );
        const text = pressable.innerText?.trim() ?? '';
        const hasTimestamp = Boolean(pressable.querySelector('time[datetime]'));
        if (text.length >= 20 && text.length <= 3000 && hasTimestamp && pressablePostIds.size === 1) {
          container = pressable;
          break;
        }
      }

      let candidate: HTMLElement | null = null;
      let current: HTMLElement | null = permalink;
      for (let depth = 0; current && depth < 16; depth += 1) {
        const postIds = new Set(
          Array.from(current.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'))
            .map((anchor) => anchor.href.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1])
            .filter(Boolean)
        );
        const text = current.innerText?.trim() ?? '';
        const hasActions = Boolean(current.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]'));
        const hasTimestamp = Boolean(current.querySelector('time[datetime]'));
        // Pick the complete root card (text + actions + media), but stop before
        // the ancestor grows into the replies/conversation container.
        if (text.length >= 20 && text.length <= 3000 && hasTimestamp && (hasActions || postIds.size === 1) && postIds.size === 1) {
          candidate = current;
        }
        if (postIds.size > 1 && candidate) break;
        current = current.parentElement;
      }
      if (candidate) {
        container = candidate;
        break;
      }
    }
    if (!container) return null;

    const lines = container.innerText.split('\n').map((line) => line.trim()).filter(Boolean);
    const dateIndex = lines.findIndex(isDateLine);
    const translateIndex = lines.findIndex((line, index) => index > dateIndex && /^(?:translate|see translation|dịch|xem bản dịch)$/i.test(line));
    const contentEnd = translateIndex > dateIndex ? translateIndex : lines.length;
    const content = lines.slice(Math.max(dateIndex + 1, 0), contentEnd).join('\n').trim();
    if (content.length < 4) return null;

    const metrics = lines
      .slice(translateIndex > -1 ? translateIndex + 1 : contentEnd)
      .filter((line) => /^\d+(?:[.,]\d+)?[KMB]?$/i.test(line))
      .map(compactToNumber)
      .slice(-4);

    return {
      id: postId,
      author,
      authorHandle: `@${author}`,
      content: content.slice(0, 900),
      likes: metrics[0] ?? 0,
      replies: metrics[1] ?? 0,
      reposts: metrics[2] ?? 0,
      timestamp: parseTimestamp(lines[dateIndex] ?? ''),
      mediaCandidates: extractMediaCandidates(container),
      url: rootUrl,
      source: 'manual',
      fetchedAt: now
    };

    function extractMediaCandidates(root: HTMLElement) {
      const candidates: Array<{
        url: string;
        kind: 'image' | 'video-poster';
        alt?: string;
        renderedWidth?: number;
        renderedHeight?: number;
      }> = [];
      for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('img[src], img[srcset]'))) {
        const url = image.currentSrc || image.src;
        if (!url) continue;
        const rect = image.getBoundingClientRect();
        candidates.push({
          url,
          kind: 'image',
          alt: image.alt ?? '',
          renderedWidth: rect.width,
          renderedHeight: rect.height
        });
      }
      for (const video of Array.from(root.querySelectorAll<HTMLVideoElement>('video[poster]'))) {
        if (video.poster) candidates.push({ url: video.poster, kind: 'video-poster' });
      }
      return candidates;
    }

    function compactToNumber(value: string) {
      const cleaned = value.replace(/\s+/g, '').replace(',', '.').toUpperCase();
      const number = Number.parseFloat(cleaned);
      if (!Number.isFinite(number)) return 0;
      if (cleaned.endsWith('B')) return Math.round(number * 1_000_000_000);
      if (cleaned.endsWith('M')) return Math.round(number * 1_000_000);
      if (cleaned.endsWith('K')) return Math.round(number * 1_000);
      return Math.round(number);
    }

    function parseTimestamp(value: string) {
      const absoluteDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (absoluteDate) {
        const day = Number(absoluteDate[1]);
        const month = Number(absoluteDate[2]) - 1;
        const year = Number(absoluteDate[3]) + (absoluteDate[3].length === 2 ? 2000 : 0);
        return new Date(year, month, day).toISOString();
      }
      const relative = value.match(/^(\d+)\s*(s|sec(?:ond)?s?|giây|m|min(?:ute)?s?|phút|h|hr|hours?|giờ|d|days?|ngày|w|weeks?|tuần)$/i);
      if (!relative) return now;
      const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
      return new Date(Date.now() - Number(relative[1]) * multipliers[normalizeRelativeUnit(relative[2])]).toISOString();
    }

    function isDateLine(line: string) {
      return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)
        || /^\d+\s*(?:s|sec(?:ond)?s?|giây|m|min(?:ute)?s?|phút|h|hr|hours?|giờ|d|days?|ngày|w|weeks?|tuần)$/i.test(line);
    }

    function normalizeRelativeUnit(unit: string) {
      const normalized = unit.toLocaleLowerCase('vi');
      if (/^(?:s|sec|second|giây)/.test(normalized)) return 's';
      if (/^(?:m|min|minute|phút)/.test(normalized)) return 'm';
      if (/^(?:h|hr|hour|giờ)/.test(normalized)) return 'h';
      if (/^(?:d|day|ngày)/.test(normalized)) return 'd';
      return 'w';
    }
  }, postUrl) as RawPostWithMediaCandidates | null;

  if (!post) return null;
  const { mediaCandidates, ...rawPost } = post;
  return { ...rawPost, imageUrls: sanitizeThreadsMediaCandidates(mediaCandidates) };
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
