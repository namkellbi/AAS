import type { ThreadsPost, ThreadsReply } from '@/lib/types';

export type AnalysisSourcePost = Pick<ThreadsPost, 'author' | 'content' | 'topReplies'> & Partial<Pick<ThreadsPost, 'authorHandle'>>;

export function postAnalysisSignature(post: AnalysisSourcePost) {
  return JSON.stringify({
    author: normalizeText(post.author).toLocaleLowerCase(),
    content: normalizeText(post.content),
    replies: post.topReplies
      .map(replyAnalysisSource)
      .sort((left, right) => left.id.localeCompare(right.id))
  });
}

function replyAnalysisSource(reply: ThreadsReply) {
  return {
    id: reply.id,
    author: normalizeText(reply.author).toLocaleLowerCase(),
    content: normalizeText(reply.content),
    hasMedia: Boolean(reply.mediaUrls?.length)
  };
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
