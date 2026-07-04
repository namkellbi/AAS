import type { AIAnalysis, OpportunityScanProgress, OpportunityScanResult, ThreadsPost } from '@/lib/types';
import { analyzeAffiliateOpportunity } from '@/server/ai/affiliateAnalysisService';
import { getAnalysis, getOpenAiApiKey, getPostAgeHours, listKeywordExclusions, listKeywordInsights, listKeywords, listPosts, markKeywordFetched, pruneUnusedResearchData } from '@/server/db/client';
import { fetchAndStoreThreads } from '@/server/services/fetchService';

const MAX_KEYWORDS_PER_SCAN = 12;
const POSTS_PER_KEYWORD = 14;
const MAX_AI_ANALYSES_PER_SCAN = 8;
const MIN_OPPORTUNITY_FOR_AI = 35;

export async function scanOpportunityInbox(onProgress: (progress: OpportunityScanProgress) => void = () => {}): Promise<OpportunityScanResult> {
  const insights = new Map(listKeywordInsights().map((insight) => [insight.keywordId, insight]));
  const keywords = listKeywords()
    .filter((keyword) => keyword.enabled)
    .sort((a, b) => Number(!b.lastFetchedAt) - Number(!a.lastFetchedAt) || (insights.get(b.id)?.score ?? 0) - (insights.get(a.id)?.score ?? 0))
    .slice(0, MAX_KEYWORDS_PER_SCAN);
  if (!keywords.length) throw new Error('Enable at least one keyword before scanning opportunities.');

  let fetchedPosts = 0;
  let newPosts = 0;
  let seenPosts = 0;
  const latestScanPosts = new Map<string, ThreadsPost>();
  const errors: string[] = [];

  for (const [index, keyword] of keywords.entries()) {
    onProgress({ phase: 'fetching', current: index + 1, total: keywords.length, percent: progressPercent(5, 65, index, keywords.length), keyword: keyword.phrase, message: `Đang fetch từ khóa "${keyword.phrase}" (${index + 1}/${keywords.length})` });
    try {
      const result = await fetchAndStoreThreads({ mode: 'keyword', query: keyword.phrase, maxPosts: POSTS_PER_KEYWORD });
      fetchedPosts += result.posts.length;
      newPosts += result.newPosts ?? 0;
      seenPosts += result.seenPosts ?? 0;
      for (const post of result.posts) latestScanPosts.set(post.id, post);
      markKeywordFetched(keyword.id);
    } catch (error) {
      errors.push(`${keyword.phrase}: ${messageFromError(error)}`);
    }
    await delay(900);
  }

  const ageLimit = getPostAgeHours();
  const exclusions = listKeywordExclusions().map((item) => item.phrase.toLowerCase());
  const posts = listPosts(160).filter(
    (post) =>
      post.opportunityScore >= 15 &&
      ageInHours(post.timestamp) <= ageLimit &&
      !exclusions.some((phrase) => `${post.content} ${post.keyword ?? ''}`.toLowerCase().includes(phrase))
  );
  const analyses = new Map<string, AIAnalysis>();
  let analyzedPosts = 0;

  for (const post of posts) {
    const analysis = getAnalysis(post.id);
    if (analysis) analyses.set(post.id, analysis);
  }

  if (getOpenAiApiKey()) {
    const candidates = posts
      .filter((post) => post.opportunityScore >= MIN_OPPORTUNITY_FOR_AI && (!analyses.has(post.id) || analyses.get(post.id)?.confidenceScore === 0))
      .sort((a, b) => Number(latestScanPosts.has(b.id)) - Number(latestScanPosts.has(a.id)) || b.opportunityScore - a.opportunityScore)
      .slice(0, MAX_AI_ANALYSES_PER_SCAN);

    for (const [index, post] of candidates.entries()) {
      onProgress({ phase: 'analyzing', current: index + 1, total: candidates.length, percent: progressPercent(72, 23, index, candidates.length), message: `AI đang shortlist bài ${index + 1}/${candidates.length}` });
      try {
        const analysis = await analyzeAffiliateOpportunity(post);
        analyses.set(post.id, analysis);
        analyzedPosts += 1;
      } catch (error) {
        errors.push(`AI ${shortPostLabel(post)}: ${messageFromError(error)}`);
      }
    }
  }

  onProgress({ phase: 'cleanup', current: 1, total: 1, percent: 97, message: 'Đang dọn bài cũ không còn sử dụng...' });
  const prunedPosts = pruneUnusedResearchData();
  onProgress({ phase: 'complete', current: 1, total: 1, percent: 100, message: `Đã quét xong. Dọn ${prunedPosts} bài cũ.` });

  return {
    posts: listPosts(160).filter(
      (post) =>
        post.opportunityScore >= 15 &&
        ageInHours(post.timestamp) <= ageLimit &&
        !exclusions.some((phrase) => `${post.content} ${post.keyword ?? ''}`.toLowerCase().includes(phrase))
    ),
    latestScanPosts: Array.from(latestScanPosts.values()).sort((a, b) => b.opportunityScore - a.opportunityScore),
    analyses: Array.from(analyses.values()),
    keywordsScanned: keywords.length,
    fetchedPosts,
    analyzedPosts,
    newPosts,
    seenPosts,
    prunedPosts,
    errors
  };
}

function progressPercent(start: number, span: number, index: number, total: number) {
  return Math.min(99, Math.round(start + ((index + 1) / Math.max(total, 1)) * span));
}

function ageInHours(timestamp: string) {
  return Math.max((Date.now() - new Date(timestamp).getTime()) / 36e5, 0);
}

function shortPostLabel(post: ThreadsPost) {
  return `${post.author} ${post.id.slice(0, 8)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
