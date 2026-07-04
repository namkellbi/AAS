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
  return replies.filter((reply) => {
    if (!reply?.id || seen.has(reply.id) || !isUsefulReplyContent(reply.content)) return false;
    seen.add(reply.id);
    return true;
  });
}
