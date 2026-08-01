import type { ThreadsReply } from '@/lib/types';

export function isUsefulReplyContent(content: string) {
  const value = content.trim();
  return value.length >= 3
    && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)
    && !/^\d+[smhdw]$/i.test(value)
    && !/^\d+(?:\.\d+)?\s*[KMB]?$/i.test(value);
}

export function filterUsefulReplies(replies: ThreadsReply[]) {
  const seen = new Set<string>();
  return replies.flatMap((reply) => {
    if (!reply?.id || seen.has(reply.id)) return [];
    const content = sanitizeThreadsReplyContent(reply.content);
    if (!isUsefulReplyContent(content)) return [];
    seen.add(reply.id);
    return [{ ...reply, content }];
  }).sort((left, right) => right.likes - left.likes);
}

export function sanitizeThreadsReplyContent(content: string) {
  return content
    // Threads sometimes exposes action controls as one unbroken accessibility
    // string appended to the reply body, e.g.
    // "TranslateLike304Comment3Repost1Share".
    .replace(
      /\s*(?:(?:translate|dịch)\s*)?like(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*comments?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*reposts?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*shares?(?:\d+(?:[.,]\d+)?\s*[KMB]?)?\s*$/iu,
      ''
    )
    .replace(/^\s*(?:\d+\s*(?:giây|phút|giờ|ngày|tuần|tháng|năm)\s*[·•]\s*)/iu, '')
    .replace(/^\s*[·•.]\s*(?:author|tác\s+giả)\s*[:·•.\-–—]?\s*/iu, '')
    .replace(/^\s*(?:author|tác\s+giả)\s*[:·•.\-–—]\s*/iu, '')
    .replace(/^\s*(?:author|tác\s+giả)\s+(?!của\b)/iu, '')
    .trim();
}
