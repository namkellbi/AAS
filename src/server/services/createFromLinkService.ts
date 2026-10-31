import type {
  AIAnalysis,
  BatchCreateFromLinksItem,
  BatchCreateFromLinksProgress,
  BatchCreateFromLinksRequest,
  BatchCreateFromLinksResult,
  CreateFromLinkProgress,
  CreateFromLinkResult,
  ThreadsPost
} from '@/lib/types';
import { evaluateBatchVideoQuality } from '@/lib/batch-video-quality';
import { analyzeAffiliateOpportunity } from '@/server/ai/affiliateAnalysisService';
import { buildManualAnalysis } from '@/server/analysis/manualAnalysis';
import { getAnalysis, getCreativeAiEnabled, getOpenAiApiKey, getSetting, listAssets, setSetting } from '@/server/db/client';
import { fetchThreadsPostsByUrls } from '@/server/scraper/threadsScraper';
import { importAndStoreThreadsPost, storeImportedThreadsPosts } from '@/server/services/fetchService';

export async function createVideoFromLink(url: string, onProgress: (progress: CreateFromLinkProgress) => void = () => {}): Promise<CreateFromLinkResult> {
  onProgress({ phase: 'importing', percent: 10, message: 'Đang nhập bài Threads từ link...' });
  const post = await importAndStoreThreadsPost(url);

  const creativeAiEnabled = getCreativeAiEnabled();
  let analysis: AIAnalysis | null = creativeAiEnabled ? getAnalysis(post.id) : buildManualAnalysis(post);
  const needsCreativeCopy = analysis && !analysis.hooks.length && !analysis.videoScript.transitionLine;
  if (creativeAiEnabled && (!analysis || analysis.confidenceScore === 0 || needsCreativeCopy)) {
    if (!getOpenAiApiKey()) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');
    onProgress({
      phase: 'analyzing',
      percent: 45,
      message: creativeAiEnabled ? 'Đang tạo nội dung bổ sung bằng AI...' : 'Đang đọc bài và chọn replies phù hợp...'
    });
    analysis = await analyzeAffiliateOpportunity(post);
  }

  if (!analysis) analysis = buildManualAnalysis(post);

  const backgroundPath = pickRandomBackground();
  onProgress({ phase: 'ready', percent: 100, message: 'Brief đã sẵn sàng.' });
  return { post, analysis, backgroundPath: backgroundPath ?? undefined };
}

export async function createVideosFromLinksBatch(
  request: BatchCreateFromLinksRequest,
  onProgress: (progress: BatchCreateFromLinksProgress) => void = () => {}
): Promise<BatchCreateFromLinksResult> {
  const urls = Array.from(new Set(request.urls.map((url) => url.trim()).filter(Boolean))).slice(0, 50);
  if (!urls.length) throw new Error('Danh sách Threads link đang trống.');
  const minCommentLikes = clampInteger(request.minCommentLikes, 0, 1_000_000, 20);
  const minQualifiedComments = clampInteger(request.minQualifiedComments, 1, 20, 3);
  let finished = 0;
  let fetchedCount = 0;

  const fetched = await fetchThreadsPostsByUrls(
    urls,
    (item, index) => {
      fetchedCount += 1;
      onProgress({
        index,
        url: item.url,
        status: 'fetching',
        current: fetchedCount,
        total: urls.length,
        percent: Math.round((fetchedCount / urls.length) * 70),
        message: item.status === 'success'
          ? 'Đã tải bài và comments · đang chờ Quality Gate...'
          : 'Không đọc được bài · đang chuẩn bị report lỗi...'
      });
    },
    (url, index) => onProgress({
      index,
      url,
      status: 'fetching',
      current: finished,
      total: urls.length,
      percent: Math.round((finished / urls.length) * 70),
      message: `Đang đọc bài ${index + 1}/${urls.length} và tải top comments...`
    })
  );

  const prepared = fetched.map((item): {
    storedPost?: ThreadsPost;
    result?: BatchCreateFromLinksItem;
    quality?: ReturnType<typeof evaluateBatchVideoQuality>;
  } => {
    if (item.status === 'failed') {
      return {
        result: {
          url: item.url,
          status: 'failed',
          qualifiedCommentCount: 0,
          fetchedCommentCount: 0,
          maxCommentLikes: 0,
          reason: compactError(item.error)
        }
      };
    }

    const quality = evaluateBatchVideoQuality(item.post, minCommentLikes, minQualifiedComments);
    if (!quality.accepted) {
      return {
        storedPost: item.post,
        result: {
          url: item.url,
          status: 'rejected',
          post: item.post,
          qualifiedCommentCount: quality.qualifiedCommentCount,
          fetchedCommentCount: quality.fetchedCommentCount,
          maxCommentLikes: quality.maxCommentLikes,
          reason: `Chỉ có ${quality.qualifiedCommentCount}/${minQualifiedComments} comment đạt từ ${minCommentLikes} likes.`
        }
      };
    }

    return {
      storedPost: { ...item.post, topReplies: quality.qualifiedReplies },
      quality
    };
  });

  storeImportedThreadsPosts(prepared.flatMap((item) => item.storedPost ? [item.storedPost] : []));

  const items: BatchCreateFromLinksItem[] = [];
  for (let index = 0; index < prepared.length; index += 1) {
    const existing = prepared[index].result;
    if (existing) {
      items.push(existing);
      finished += 1;
      onProgress(progressForCompletedItem(existing, index, finished, urls.length));
      continue;
    }

    const post = prepared[index].storedPost!;
    const quality = prepared[index].quality!;
    try {
      const analysis = await analysisForPost(post);
      const ready: BatchCreateFromLinksItem = {
        url: urls[index],
        status: 'ready',
        post,
        analysis,
        backgroundPath: pickRandomBackground() ?? undefined,
        qualifiedCommentCount: quality.qualifiedCommentCount,
        fetchedCommentCount: quality.fetchedCommentCount,
        maxCommentLikes: quality.maxCommentLikes
      };
      items.push(ready);
      finished += 1;
      onProgress(progressForCompletedItem(ready, index, finished, urls.length));
    } catch (error) {
      const failed: BatchCreateFromLinksItem = {
        url: urls[index],
        status: 'failed',
        post,
        qualifiedCommentCount: quality.qualifiedCommentCount,
        fetchedCommentCount: quality.fetchedCommentCount,
        maxCommentLikes: quality.maxCommentLikes,
        reason: compactError(error instanceof Error ? error.message : String(error))
      };
      items.push(failed);
      finished += 1;
      onProgress(progressForCompletedItem(failed, index, finished, urls.length));
    }
  }

  return {
    items,
    readyCount: items.filter((item) => item.status === 'ready').length,
    rejectedCount: items.filter((item) => item.status === 'rejected').length,
    failedCount: items.filter((item) => item.status === 'failed').length
  };
}

async function analysisForPost(post: ThreadsPost) {
  if (!getCreativeAiEnabled()) return buildManualAnalysis(post);
  let analysis = getAnalysis(post.id);
  const needsCreativeCopy = analysis && !analysis.hooks.length && !analysis.videoScript.transitionLine;
  if (!analysis || analysis.confidenceScore === 0 || needsCreativeCopy) {
    if (!getOpenAiApiKey()) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');
    analysis = await analyzeAffiliateOpportunity(post);
  }
  return analysis ?? buildManualAnalysis(post);
}

function progressForCompletedItem(
  item: BatchCreateFromLinksItem,
  index: number,
  current: number,
  total: number
): BatchCreateFromLinksProgress {
  const message = item.status === 'ready'
    ? `Đạt Quality Gate · ${item.qualifiedCommentCount} comments phù hợp.`
    : item.status === 'rejected'
      ? `Đã loại · ${item.reason}`
      : `Lỗi · ${item.reason}`;
  return {
    index,
    url: item.url,
    status: item.status,
    current,
    total,
    percent: 70 + Math.round((current / total) * 30),
    message,
    qualifiedCommentCount: item.qualifiedCommentCount
  };
}

function clampInteger(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function compactError(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 320);
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
