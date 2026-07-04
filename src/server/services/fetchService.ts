import type { FetchRequest, FetchResult, ThreadsPost } from '@/lib/types';
import { createFetchLog, enrichPostsWithVelocity, finishFetchLog, listExistingPostIds, pruneUnusedResearchData, recordEngagementSnapshots, removeLegacyPostsForKeyword, upsertPosts } from '@/server/db/client';
import { filterUsefulReplies } from '@/lib/replies';
import { fetchThreadsPostByUrl, fetchThreadsPosts, scrapeThreadsPostReplies } from '@/server/scraper/threadsScraper';
import { scorePost } from '@/server/scoring/trendingScore';
import { withRetry } from '@/server/utils/withRetry';

export async function fetchAndStoreThreads(request: FetchRequest): Promise<FetchResult> {
  const logId = createFetchLog(request.mode, request.query);

  try {
    const fetchedPosts = await withRetry(() => fetchThreadsPosts(request));
    if (!fetchedPosts.length) {
      finishFetchLog(logId, 'success', 0, 'Threads search returned no posts. Try a broader keyword.');
      return { posts: [], logId, warning: 'no_posts_found' };
    }
    const existing = listExistingPostIds(fetchedPosts.map((post) => post.id));
    const posts = scoreStoredPosts(enrichPostsWithVelocity(fetchedPosts));
    upsertPosts(posts);
    recordEngagementSnapshots(posts);
    if (request.query && posts.some((post) => /\/post\//.test(post.url))) removeLegacyPostsForKeyword(request.query);
    pruneUnusedResearchData();
    finishFetchLog(logId, 'success', posts.length);
    return { posts, logId, newPosts: posts.length - existing.size, seenPosts: existing.size };
  } catch (error) {
    finishFetchLog(logId, 'error', 0, messageFromError(error));
    throw error;
  }
}

export async function importAndStoreThreadsPost(postUrl: string) {
  const logId = createFetchLog('manual', postUrl);

  try {
    const fetchedPost = await withRetry(() => fetchThreadsPostByUrl(postUrl));
    const [post] = scoreStoredPosts(enrichPostsWithVelocity([fetchedPost]));
    upsertPosts([post]);
    recordEngagementSnapshots([post]);
    pruneUnusedResearchData();
    finishFetchLog(logId, 'success', 1);
    return post;
  } catch (error) {
    finishFetchLog(logId, 'error', 0, messageFromError(error));
    throw error;
  }
}

export async function refreshPostReplies(post: ThreadsPost) {
  const topReplies = filterUsefulReplies(await withRetry(() => scrapeThreadsPostReplies(post.url)));
  const next = { ...post, topReplies };
  const score = scorePost(next);
  const updated = {
    ...next,
    trendingScore: score.score,
    affiliateFitScore: score.affiliateFitScore,
    opportunityScore: score.opportunityScore,
    velocityScore: score.velocityScore,
    videoPotentialScore: score.videoPotentialScore,
    emotionalCategory: score.emotionalCategory
  };
  upsertPosts([updated]);
  return updated;
}

function scoreStoredPosts(posts: ThreadsPost[]) {
  return posts.map((post) => {
    const score = scorePost(post);
    return { ...post, trendingScore: score.score, affiliateFitScore: score.affiliateFitScore, opportunityScore: score.opportunityScore, velocityScore: score.velocityScore, videoPotentialScore: score.videoPotentialScore };
  });
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
