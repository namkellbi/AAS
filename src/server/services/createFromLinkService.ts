import type { AIAnalysis, CreateFromLinkProgress, CreateFromLinkResult } from '@/lib/types';
import { analyzeAffiliateOpportunity } from '@/server/ai/affiliateAnalysisService';
import { getAnalysis, getOpenAiApiKey, listAssets } from '@/server/db/client';
import { importAndStoreThreadsPost } from '@/server/services/fetchService';

export async function createVideoFromLink(url: string, onProgress: (progress: CreateFromLinkProgress) => void = () => {}): Promise<CreateFromLinkResult> {
  onProgress({ phase: 'importing', percent: 10, message: 'Đang nhập bài Threads từ link...' });
  const post = await importAndStoreThreadsPost(url);

  let analysis: AIAnalysis | null = getAnalysis(post.id);
  if (!analysis || analysis.confidenceScore === 0) {
    if (!getOpenAiApiKey()) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');
    onProgress({ phase: 'analyzing', percent: 45, message: 'Đang chạy AI phân tích cơ hội affiliate...' });
    analysis = await analyzeAffiliateOpportunity(post);
  }

  const backgroundPath = pickLeastRecentlyUsedBackground();
  onProgress({ phase: 'ready', percent: 100, message: 'Brief đã sẵn sàng.' });
  return { post, analysis, backgroundPath: backgroundPath ?? undefined };
}

function pickLeastRecentlyUsedBackground(): string | null {
  const backgrounds = listAssets().filter((asset) => asset.type === 'background');
  if (!backgrounds.length) return null;
  backgrounds.sort((a, b) => {
    if (!a.lastUsedAt && b.lastUsedAt) return -1;
    if (a.lastUsedAt && !b.lastUsedAt) return 1;
    if (a.lastUsedAt && b.lastUsedAt && a.lastUsedAt !== b.lastUsedAt) return a.lastUsedAt.localeCompare(b.lastUsedAt);
    return a.timesUsed - b.timesUsed;
  });
  return backgrounds[0].filePath;
}
