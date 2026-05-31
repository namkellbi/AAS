import type { AIAnalysis, OpportunityScanResult, ThreadsPost } from '@/lib/types';
import { analyzeAffiliateOpportunity } from '@/server/ai/affiliateAnalysisService';
import { getAnalysis, getOpenAiApiKey, listKeywords, listPosts, markKeywordFetched } from '@/server/db/client';
import { fetchAndStoreThreads } from '@/server/services/fetchService';

const MAX_KEYWORDS_PER_SCAN = 12;
const POSTS_PER_KEYWORD = 14;
const MAX_AI_ANALYSES_PER_SCAN = 3;
const MIN_OPPORTUNITY_FOR_AI = 35;

export async function scanOpportunityInbox(): Promise<OpportunityScanResult> {
  const keywords = listKeywords().filter((keyword) => keyword.enabled).slice(0, MAX_KEYWORDS_PER_SCAN);
  if (!keywords.length) throw new Error('Enable at least one keyword before scanning opportunities.');

  let fetchedPosts = 0;
  const latestScanPosts = new Map<string, ThreadsPost>();
  const errors: string[] = [];

  for (const keyword of keywords) {
    try {
      const result = await fetchAndStoreThreads({ mode: 'keyword', query: keyword.phrase, maxPosts: POSTS_PER_KEYWORD });
      fetchedPosts += result.posts.length;
      for (const post of result.posts) latestScanPosts.set(post.id, post);
      markKeywordFetched(keyword.id);
    } catch (error) {
      errors.push(`${keyword.phrase}: ${messageFromError(error)}`);
    }
    await delay(900);
  }

  const posts = listPosts(80).filter((post) => post.opportunityScore >= 15);
  const analyses = new Map<string, AIAnalysis>();

  for (const post of posts) {
    const analysis = getAnalysis(post.id);
    if (analysis) analyses.set(post.id, analysis);
  }

  if (getOpenAiApiKey()) {
    const candidates = posts
      .filter((post) => post.opportunityScore >= MIN_OPPORTUNITY_FOR_AI && (!analyses.has(post.id) || analyses.get(post.id)?.confidenceScore === 0))
      .slice(0, MAX_AI_ANALYSES_PER_SCAN);

    for (const post of candidates) {
      try {
        const analysis = await analyzeAffiliateOpportunity(post);
        analyses.set(post.id, analysis);
      } catch (error) {
        errors.push(`AI ${shortPostLabel(post)}: ${messageFromError(error)}`);
      }
    }
  }

  return {
    posts,
    latestScanPosts: Array.from(latestScanPosts.values()).sort((a, b) => b.opportunityScore - a.opportunityScore),
    analyses: Array.from(analyses.values()),
    keywordsScanned: keywords.length,
    fetchedPosts,
    analyzedPosts: analyses.size,
    errors
  };
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
