import type { ThreadsPost, ThreadsReply } from '@/lib/types';

type ReplyThreadContext = Pick<ThreadsPost, 'author' | 'authorHandle' | 'content'>;

type Segment = {
  index: number;
  total: number;
};

export function isUsefulReplyContent(content: string) {
  const value = content.trim();
  return value.length >= 3
    && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)
    && !/^\d+[smhdw]$/i.test(value)
    && !/^\d+(?:\.\d+)?\s*[KMB]?$/i.test(value);
}

export function filterUsefulReplies(replies: ThreadsReply[], context?: ReplyThreadContext) {
  const seen = new Set<string>();
  const usefulReplies = replies.flatMap((reply) => {
    if (!reply?.id || seen.has(reply.id)) return [];
    const content = sanitizeThreadsReplyContent(reply.content);
    if (!isUsefulReplyContent(content)) return [];
    seen.add(reply.id);
    return [{ ...reply, content }];
  });

  return sortReplies(usefulReplies, context);
}

/**
 * Threads labels a creator's continuation posts with markers such as 1/4,
 * 2/4, ... . Put those direct continuation replies first and in reading order;
 * all unrelated replies keep the existing likes-descending order.
 */
function sortReplies(replies: ThreadsReply[], context?: ReplyThreadContext) {
  const annotated = replies.map((reply, position) => ({
    reply,
    position,
    segment: segmentFromReply(reply),
    author: normalizeAuthor(reply.author)
  }));
  const series = findMultipartSeries(annotated, context);

  return annotated
    .sort((left, right) => {
      const leftSegment = segmentInSeries(left, series);
      const rightSegment = segmentInSeries(right, series);
      if (leftSegment && rightSegment) {
        return leftSegment.index - rightSegment.index
          || right.reply.likes - left.reply.likes
          || left.position - right.position;
      }
      if (leftSegment) return -1;
      if (rightSegment) return 1;
      return right.reply.likes - left.reply.likes || left.position - right.position;
    })
    .map(({ reply }) => reply);
}

function findMultipartSeries(
  replies: Array<{ reply: ThreadsReply; segment?: Segment; author: string }>,
  context?: ReplyThreadContext
) {
  const rootSegment = context ? segmentFromContent(context.content) : undefined;
  const rootAuthors = new Set(
    context
      ? [context.author, context.authorHandle ?? ''].map(normalizeAuthor).filter(Boolean)
      : []
  );

  // The scraper stores explicit indexes for a self-thread even when Threads
  // does not expose its visual 2/N badge in innerText. Treat that metadata as
  // authoritative, including a two-part thread with only one continuation.
  const explicitContinuation = replies.find(({ reply, author, segment }) =>
    rootAuthors.has(author)
      && segment !== undefined
      && segment.index === reply.segmentIndex
      && segment.total === reply.segmentTotal
      && segment.index > 1
  );
  if (explicitContinuation?.segment) {
    return { author: explicitContinuation.author, total: explicitContinuation.segment.total };
  }

  if (rootSegment?.index === 1) {
    const matchingAuthor = replies.find(({ author, segment }) =>
      rootAuthors.has(author) && segment?.total === rootSegment.total && segment.index > 1
    )?.author;
    if (matchingAuthor) return { author: matchingAuthor, total: rootSegment.total };
  }

  const groups = new Map<string, { author: string; total: number; indexes: Set<number> }>();
  for (const { author, segment } of replies) {
    if (!author || !segment || segment.index < 2) continue;
    const key = `${author}:${segment.total}`;
    const group = groups.get(key) ?? { author, total: segment.total, indexes: new Set<number>() };
    group.indexes.add(segment.index);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.indexes.size >= 2 && hasLikelyContinuation(group.indexes))
    .sort((left, right) => right.indexes.size - left.indexes.size || left.total - right.total)[0];
}

function hasLikelyContinuation(indexes: Set<number>) {
  if (indexes.has(2)) return true;
  const ordered = Array.from(indexes).sort((left, right) => left - right);
  return ordered.some((value, index) => index > 0 && value === ordered[index - 1] + 1);
}

function segmentInSeries(
  value: { segment?: Segment; author: string },
  series?: { author: string; total: number }
) {
  return series && value.author === series.author && value.segment?.total === series.total
    ? value.segment
    : undefined;
}

function segmentFromReply(reply: ThreadsReply) {
  const explicit = validSegment(reply.segmentIndex, reply.segmentTotal);
  return explicit ?? segmentFromContent(reply.content);
}

function segmentFromContent(content: string) {
  const match = content.trim().match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})\s*[.)\]]?\s*$/u);
  return match ? validSegment(Number(match[1]), Number(match[2])) : undefined;
}

function validSegment(index?: number, total?: number): Segment | undefined {
  return Number.isInteger(index) && Number.isInteger(total) && index! >= 1 && total! >= 2 && index! <= total! && total! <= 99
    ? { index: index!, total: total! }
    : undefined;
}

function normalizeAuthor(value: string) {
  return value.trim().replace(/^@/, '').toLocaleLowerCase();
}

export function sanitizeThreadsReplyContent(content: string) {
  return content
    // Threads exposes the separator before its Author label as a standalone
    // DOM line, which can otherwise become "· Reply text" after extraction.
    .replace(/^\s*(?:[\u00b7\u2022]|\.(?=\s))\s*/u, '')
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
