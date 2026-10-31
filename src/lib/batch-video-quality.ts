import { filterUsefulReplies } from '@/lib/replies';
import type { ThreadsPost, ThreadsReply } from '@/lib/types';

export type BatchVideoQualityResult = {
  accepted: boolean;
  qualifiedReplies: ThreadsReply[];
  qualifiedCommentCount: number;
  fetchedCommentCount: number;
  maxCommentLikes: number;
};

export function evaluateBatchVideoQuality(
  post: ThreadsPost,
  minCommentLikes: number,
  minQualifiedComments: number
): BatchVideoQualityResult {
  const usefulReplies = filterUsefulReplies(post.topReplies, post);
  const qualifiedReplies = usefulReplies.filter((reply) => reply.likes >= minCommentLikes);
  return {
    accepted: qualifiedReplies.length >= minQualifiedComments,
    qualifiedReplies,
    qualifiedCommentCount: qualifiedReplies.length,
    fetchedCommentCount: usefulReplies.length,
    maxCommentLikes: usefulReplies.reduce((maximum, reply) => Math.max(maximum, reply.likes), 0)
  };
}
