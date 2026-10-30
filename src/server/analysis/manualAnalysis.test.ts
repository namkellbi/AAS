import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadsPost } from '@/lib/types';
import { buildManualAnalysis } from './manualAnalysis';

const post: ThreadsPost = {
  id: 'post-1',
  author: 'creator',
  content: 'Bài viết gốc',
  likes: 100,
  replies: 3,
  reposts: 5,
  timestamp: '2026-10-29T00:00:00.000Z',
  imageUrls: [],
  url: 'https://www.threads.com/@creator/post/post-1',
  source: 'manual',
  fetchedAt: '2026-10-29T00:00:00.000Z',
  trendingScore: 70,
  affiliateFitScore: 60,
  opportunityScore: 75,
  velocityScore: 50,
  engagementGrowthPercent: 0,
  emotionalCategory: 'relatable',
  topReplies: [
    { id: 'low', author: 'a', content: 'Ít like', likes: 2 },
    { id: 'high', author: 'b', content: 'Nhiều like', likes: 20 }
  ],
  trendState: 'GROWING',
  likesPerHour: 10,
  repliesPerHour: 2,
  videoPotentialScore: 65,
  engagementScore: 55
};

test('builds an API-free analysis from the original post and locally ranked replies', () => {
  const analysis = buildManualAnalysis(post);

  assert.equal(analysis.postId, post.id);
  assert.equal(analysis.videoScript.postReadVersion, post.content);
  assert.deepEqual(analysis.hooks, []);
  assert.deepEqual(analysis.ctas, []);
  assert.equal(analysis.bestReplies[0]?.id, 'high');
  assert.equal(analysis.bestReplies[0]?.type, 'TOP_LIKED');
});
