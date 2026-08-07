import type { AIAnalysis, CreateFromLinkProgress, CreateFromLinkResult } from '@/lib/types';
import { analyzeAffiliateOpportunity } from '@/server/ai/affiliateAnalysisService';
import { getAnalysis, getCreativeAiEnabled, getOpenAiApiKey, getSetting, listAssets, setSetting } from '@/server/db/client';
import { importAndStoreThreadsPost } from '@/server/services/fetchService';

export async function createVideoFromLink(url: string, onProgress: (progress: CreateFromLinkProgress) => void = () => {}): Promise<CreateFromLinkResult> {
  onProgress({ phase: 'importing', percent: 10, message: 'Đang nhập bài Threads từ link...' });
  const post = await importAndStoreThreadsPost(url);

  let analysis: AIAnalysis | null = getAnalysis(post.id);
  const creativeAiEnabled = getCreativeAiEnabled();
  const needsCreativeCopy = creativeAiEnabled && analysis && !analysis.hooks.length && !analysis.videoScript.transitionLine;
  if (!analysis || analysis.confidenceScore === 0 || needsCreativeCopy) {
    if (!getOpenAiApiKey()) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');
    onProgress({
      phase: 'analyzing',
      percent: 45,
      message: creativeAiEnabled ? 'Đang tạo nội dung bổ sung bằng AI...' : 'Đang đọc bài và chọn replies phù hợp...'
    });
    analysis = await analyzeAffiliateOpportunity(post);
  }

  const backgroundPath = pickRandomBackground();
  onProgress({ phase: 'ready', percent: 100, message: 'Brief đã sẵn sàng.' });
  return { post, analysis, backgroundPath: backgroundPath ?? undefined };
}

function pickRandomBackground(): string | null {
  const backgrounds = listAssets().filter((asset) => asset.type === 'background');
  if (!backgrounds.length) return null;
  const last = getSetting('video.last_background_clip');
  const pool = backgrounds.length > 1 ? backgrounds.filter((asset) => asset.filePath !== last) : backgrounds;
  const selected = pool[Math.floor(Math.random() * pool.length)] ?? backgrounds[0];
  setSetting('video.last_background_clip', selected.filePath);
  return selected.filePath;
}
