import { filterUsefulReplies } from '@/lib/replies';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';

export function buildManualAnalysis(post: ThreadsPost): AIAnalysis {
  const bestReplies = filterUsefulReplies(post.topReplies, post)
    .slice(0, 10)
    .map((reply) => ({
      ...reply,
      type: 'TOP_LIKED',
      whySelected: 'Top reply by likes'
    }));

  return {
    postId: post.id,
    verdict: verdictFromScore(post.opportunityScore),
    confidenceScore: 100,
    emotion: post.emotionalCategory || 'curiosity',
    painPoint: '',
    buyingIntent: 'low',
    affiliateCategories: [],
    affiliateProducts: [],
    contentAngle: '',
    whyViral: '',
    hooks: [],
    ctas: [],
    relatabilityScore: 0,
    controversyScore: 0,
    affiliateFitScore: post.affiliateFitScore,
    personas: [],
    situations: [],
    demoAngle: '',
    contentFormat: 'comment_compilation',
    solutionScript: '',
    productSearchKeywords: [],
    scriptOutline: [],
    rejectReason: undefined,
    commentClassifications: [],
    bestReplies,
    videoPotentialScore: post.videoPotentialScore,
    videoPotentialBreakdown: { visual: 0, demo: 0, emotional: 0, curiosity: 0 },
    tiktokCaption: '',
    hashtags: [],
    marketplaceKeywords: { tiktokShop: '', shopee: '' },
    videoScript: {
      postReadVersion: post.content,
      transitionLine: '',
      solutionText: '',
      ctaText: '',
      captionVariants: []
    },
    contentGoal: 'affiliate',
    matchedProductId: undefined,
    createdAt: nowIso()
  };
}

function verdictFromScore(score: number): AIAnalysis['verdict'] {
  if (score >= 72) return 'make_now';
  if (score >= 45) return 'watch';
  return 'skip';
}
