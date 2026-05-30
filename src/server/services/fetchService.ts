import type { FetchRequest, FetchResult } from '@/lib/types';
import { createFetchLog, finishFetchLog, getAllowDemoMode, removeLegacyPostsForKeyword, upsertPosts } from '@/server/db/client';
import { demoPosts } from '@/lib/mock-data';
import { fetchThreadsPosts } from '@/server/scraper/threadsScraper';

export async function fetchAndStoreThreads(request: FetchRequest): Promise<FetchResult> {
  const logId = createFetchLog(request.mode, request.query);

  try {
    const posts = await fetchThreadsPosts(request);
    if (!posts.length) throw new Error('Threads fetch returned 0 posts. Login may be required or selectors may need updating.');
    upsertPosts(posts);
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
