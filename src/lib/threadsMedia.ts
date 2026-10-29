export type ThreadsMediaCandidate = {
  url: string;
  kind: 'image' | 'video-poster' | 'metadata' | 'stored';
  alt?: string;
  renderedWidth?: number;
  renderedHeight?: number;
};

const minimumRenderedWidth = 120;
const minimumRenderedHeight = 90;

export function sanitizeThreadsMediaCandidates(candidates: ThreadsMediaCandidate[], limit = 10) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const url = candidate.url.trim();
    if (!url || seen.has(url) || !isThreadsPostMediaCandidate({ ...candidate, url })) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }

  return urls;
}

export function sanitizeThreadsPostImageUrls(urls: readonly string[], limit = 10) {
  return sanitizeThreadsMediaCandidates(
    urls.map((url) => ({ url, kind: 'stored' })),
    limit
  );
}

export function firstThreadsPostImageUrl(urls: readonly string[]) {
  return sanitizeThreadsPostImageUrls(urls, 1)[0];
}

export function isThreadsPostMediaCandidate(candidate: ThreadsMediaCandidate) {
  if (!isSupportedImageUrl(candidate.url) || isThreadsProfileOrUiImageUrl(candidate.url)) return false;

  if (candidate.kind === 'image') {
    if (isProfileImageAlt(candidate.alt ?? '')) return false;
    if (!isRenderedPostMediaSize(candidate.renderedWidth, candidate.renderedHeight)) return false;
  }

  return true;
}

function isRenderedPostMediaSize(width?: number, height?: number) {
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width! >= minimumRenderedWidth
    && height! >= minimumRenderedHeight;
}

function isProfileImageAlt(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/[_-]+/g, ' ');
  return /\b(?:profile\s+(?:picture|photo|image)|avatar|anh\s+dai\s+dien)\b/i.test(normalized);
}

function isThreadsProfileOrUiImageUrl(value: string) {
  if (/^data:image\//i.test(value)) return false;

  try {
    const url = new URL(value);
    const decodedUrl = decodeURIComponent(url.href).toLocaleLowerCase();
    return /\/v\/t[^/]+-19\//i.test(url.pathname)
      || /\/rsrc\.php(?:\/|$)/i.test(url.pathname)
      || /(?:profile[_-]?pic|profile[_-]?photo|anonymous[_-]?profile)/i.test(decodedUrl);
  } catch {
    return true;
  }
}

function isSupportedImageUrl(value: string) {
  if (/^data:image\//i.test(value)) return true;

  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
