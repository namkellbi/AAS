import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBatchVideoQuality } from './batch-video-quality';
import type { ThreadsPost } from './types';

function postWithLikes(...likes: number[]): ThreadsPost {
  return {
    id: 'post-1',
    author: 'creator',
    authorHandle: '@creator',
    content: 'Một bài viết đủ dài để kiểm tra quality gate.',
    likes: 100,
    replies: likes.length,
    reposts: 0,
    timestamp: new Date(0).toISOString(),
    imageUrls: [],
    url: 'https://www.threads.com/@creator/post/post-1',
    source: 'manual',
    fetchedAt: new Date(0).toISOString(),
    trendingScore: 0,
    affiliateFitScore: 0,
    opportunityScore: 0,
    velocityScore: 0,
    engagementGrowthPercent: 0,
    emotionalCategory: '',
    topReplies: likes.map((replyLikes, index) => ({
      id: `reply-${index}`,
      author: `reader-${index}`,
      content: `Nội dung bình luận hữu ích số ${index + 1}`,
      likes: replyLikes
    })),
    trendState: 'EMERGING',
    likesPerHour: 0,
    repliesPerHour: 0,
    videoPotentialScore: 0,
    engagementScore: 0
  };
}

test('accepts a post only when enough comments meet the minimum likes', () => {
  const result = evaluateBatchVideoQuality(postWithLikes(100, 31, 20, 19), 20, 3);
  assert.equal(result.accepted, true);
  assert.equal(result.qualifiedCommentCount, 3);
  assert.deepEqual(result.qualifiedReplies.map((reply) => reply.likes), [100, 31, 20]);
});

test('rejects a post with high post engagement but too few qualified comments', () => {
  const result = evaluateBatchVideoQuality(postWithLikes(200, 19, 8, 2), 20, 3);
  assert.equal(result.accepted, false);
  assert.equal(result.qualifiedCommentCount, 1);
  assert.equal(result.fetchedCommentCount, 4);
  assert.equal(result.maxCommentLikes, 200);
});
