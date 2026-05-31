import type { FetchRequest, FetchResult } from '@/lib/types';
import { createFetchLog, enrichPostsWithVelocity, finishFetchLog, getAllowDemoMode, recordEngagementSnapshots, removeLegacyPostsForKeyword, upsertPosts } from '@/server/db/client';
import { demoPosts } from '@/lib/mock-data';
import { fetchThreadsPosts } from '@/server/scraper/threadsScraper';

export async function fetchAndStoreThreads(request: FetchRequest): Promise<FetchResult> {
  const logId = createFetchLog(request.mode, request.query);

  try {
    const fetchedPosts = await fetchThreadsPosts(request);
    if (!fetchedPosts.length) {
      finishFetchLog(logId, 'success', 0, 'Threads search returned no posts. Try a broader keyword.');
      return { posts: [], logId, warning: 'no_posts_found' };
    }
    const posts = enrichPostsWithVelocity(fetchedPosts);
    upsertPosts(posts);
    recordEngagementSnapshots(posts);
    if (request.query && posts.some((post) => /\/post\//.test(post.url))) removeLegacyPostsForKeyword(request.query);
    finishFetchLog(logId, 'success', posts.length);
    return { posts, logId };
  } catch (error) {
    if (getAllowDemoMode()) {
      const fallback = demoPosts.filter((post) => !request.query || post.content.toLowerCase().includes(request.query.toLowerCase()) || post.keyword?.includes(request.query.toLowerCase()));
      upsertPosts(fallback);
      finishFetchLog(logId, 'success', fallback.length, `Demo mode used after scraper error: ${messageFromError(error)}`);
      return { posts: fallback, logId };
    }

    finishFetchLog(logId, 'error', 0, messageFromError(error));
    throw error;
  }
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
