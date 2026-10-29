export type ThreadsCookieLike = {
  name: string;
  domain: string;
  expires?: number;
};

const loginDescriptionPatterns = [
  /^join threads to share (?:ideas|thoughts)\b.*\blog in with your instagram\.?$/i,
  /^say more with threads\b.*\b(?:continue|log in) with instagram\.?$/i,
  /^this content is unavailable\.?$/i
];

export function hasThreadsAuthCookie(cookies: ThreadsCookieLike[], nowSeconds = Date.now() / 1000) {
  return cookies.some((cookie) => {
    if (cookie.name.toLowerCase() !== 'sessionid') return false;
    if (!isThreadsAuthDomain(cookie.domain)) return false;
    return !cookie.expires || cookie.expires < 0 || cookie.expires > nowSeconds;
  });
}

export function isThreadsLoginUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (isThreadsDomain(hostname)) return /^\/login(?:\/|$)/i.test(url.pathname);
    return isInstagramDomain(hostname) && /^\/accounts\/login(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function isInvalidThreadsPostRedirect(value: string) {
  try {
    const url = new URL(value);
    return isThreadsDomain(url.hostname) && url.searchParams.get('error') === 'invalid_post';
  } catch {
    return false;
  }
}

export function threadsUrlHasPostId(value: string, postId: string) {
  try {
    const url = new URL(value);
    if (!isThreadsDomain(url.hostname)) return false;
    return url.pathname.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1] === postId;
  } catch {
    return false;
  }
}

export function isGenericThreadsLoginMetadata(title: string, description: string) {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  if (/^threads\s*[\u2022\u00b7|\-]\s*log in$/i.test(normalizedTitle)) return true;
  return loginDescriptionPatterns.some((pattern) => pattern.test(normalizedDescription));
}

export function isGenericThreadsContent(value: string) {
  const normalized = normalizeText(value);
  return loginDescriptionPatterns.some((pattern) => pattern.test(normalized));
}

function isThreadsAuthDomain(value: string) {
  const domain = value.replace(/^\./, '').toLowerCase();
  return isThreadsDomain(domain) || isInstagramDomain(domain);
}

function isThreadsDomain(value: string) {
  const hostname = value.replace(/^\./, '').toLowerCase();
  return hostname === 'threads.com'
    || hostname.endsWith('.threads.com')
    || hostname === 'threads.net'
    || hostname.endsWith('.threads.net');
}

function isInstagramDomain(value: string) {
  const hostname = value.replace(/^\./, '').toLowerCase();
  return hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
