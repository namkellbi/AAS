import type { AffiliateFitBreakdown, ThreadsPost, TrendState, ViralScoreBreakdown } from '@/lib/types';
import { clamp } from '@/lib/utils';

const emotionalTerms = [
  'struggle', 'hate', 'embarrassing', 'insecure', 'anxious', 'tired', 'pain', 'annoying', 'worst', 'need', 'afraid', 'awkward',
  'kho chiu', 'bat tien', 'met', 'dau', 'ngai', 'so', 'tu ti', 'uc che', 'oan uc', 'phat dien', 'khong noi', 'kho tho'
];

const controversialTerms = [
  'unpopular opinion', 'hot take', 'nobody talks about', 'stop', 'never', 'always', 'everyone', 'people with', 'normalize', 'overrated',
  'khong ai noi', 'su that la', 'thuc ra', 'luc nao cung', 'ai cung', 'dung bao gio', 'toi gi', 'lam mau', 'ngoai tinh'
];

const relatabilityTerms = [
  'people with', 'anyone else', 'no one tells you', 'when you', 'always', 'every time', 'why is it', 'the worst part', "i can't be the only one",
  'co ai bi', 'ai cung bi', 'moi lan', 'cu moi lan', 'luc nao cung', 'khong phai minh toi', 'team', 'may dua', 'chi em', 'dan ', 'hoi ai'
];

const painPointTerms = [
  'struggle', 'pain', 'annoying', 'problem', 'hate', 'worst', 'slip', 'loose', 'fall', 'hurt', 'dry', 'oily',
  'bi tut', 'tut xuong', 'bi roi', 'roi xuong', 'bi long', 'bi meo', 'bi dau', 'dau lung', 'dau co', 'kho chiu', 'bat tien', 'do dau',
  'do mo hoi', 'da dau', 'noi mun', 'kho ngu', 'mat ngu', 'ngua', 'nong', 'mui thap', 'can thi', 'khong vua', 'kho tho'
];

const productSolvabilityTerms = [
  'fix', 'solution', 'use', 'wear', 'apply', 'attach', 'holder', 'hook', 'pad', 'accessory', 'tool',
  'cach', 'meo', 'giu', 'chong', 'gan', 'cai', 'mieng', 'moc', 'day', 'kem', 'may', 'phu kien', 'silicone', 'dung cu', 'bo gai', 'loai nay',
  'mua', 'brand', 'hang nao', 'loai nao', 'vest', 'blazer', 'ao', 'quan', 'kinh', 'serum', 'sua rua mat', 'kem chong nang'
];

const demoTerms = [
  'before', 'after', 'slip', 'fall', 'loose', 'oily', 'sweat', 'attach', 'apply',
  'tut', 'roi', 'long', 'meo', 'truot', 'dau', 'mo hoi', 'van dong', 'cui xuong', 'gan vao', 'cai vao', 'bam', 'dinh', 'thu'
];

const audienceTerms = [
  'people with', 'anyone', 'team', 'office', 'students', 'women', 'men',
  'ai bi', 'ai co', 'nguoi bi', 'nguoi hay', 'dan ', 'team', 'chi em', 'may dua', 'cac ban', 'me bim', 'dan van phong', 'nguoi can'
];

const buyingIntentTerms = [
  'buy', 'link', 'price', 'review', 'recommend', 'need', 'where to buy', 'try',
  'mua', 'xin link', 'link dau', 'gia bao nhieu', 'review', 'dung thu', 'thu di', 'can mua', 'o dau', 'loai nao', 'recommend'
];

const emotionCategories: Array<[string, string[]]> = [
  ['insecurity', ['insecure', 'embarrassing', 'ugly', 'body', 'face', 'nose', 'skin', 'tu ti', 'ngai', 'mat', 'mui', 'da', 'beo', 'xau']],
  ['frustration', ['annoying', 'hate', 'struggle', 'worst', 'tired', 'kho chiu', 'uc che', 'met', 'bat tien', 'oan uc']],
  ['anxiety', ['anxious', 'afraid', 'worried', 'panic', 'so', 'lo', 'hoang']],
  ['aspiration', ['wish', 'finally', 'dream', 'upgrade', 'better', 'muon', 'uoc', 'dep hon', 'tot hon']],
  ['fatigue', ['sleep', 'tired', 'exhausted', 'burnout', 'drained', 'ngu', 'met', 'kiet suc']]
];

type ScorablePost = Omit<ThreadsPost, 'trendingScore' | 'affiliateFitScore' | 'opportunityScore' | 'velocityScore' | 'engagementGrowthPercent' | 'emotionalCategory'>;

export function scorePost(post: ScorablePost): {
  score: number;
  affiliateFitScore: number;
  opportunityScore: number;
  velocityScore: number;
  videoPotentialScore: number;
  engagementGrowthPercent: number;
  emotionalCategory: string;
  breakdown: ViralScoreBreakdown;
  affiliateBreakdown: AffiliateFitBreakdown;
} {
  const ageHours = Math.max((Date.now() - new Date(post.timestamp).getTime()) / 36e5, 0.5);
  const engagement = post.likes + post.replies * 3 + post.reposts * 4;
  const perHour = engagement / ageHours;
  const text = normalizeText(post.content);
  const repliesText = normalizeText(post.topReplies.map((reply) => reply.content).join(' '));
  const combinedText = `${text} ${repliesText}`;

  const breakdown: ViralScoreBreakdown = {
    likesVelocity: clamp(Math.log10(perHour + 1) * 18, 0, 25),
    replies: clamp(Math.log10(post.replies + 1) * 9, 0, 18),
    reposts: clamp(Math.log10(post.reposts + 1) * 10, 0, 20),
    emotionalWording: keywordScore(text, emotionalTerms, 14, 3),
    controversialWording: keywordScore(text, controversialTerms, 12, 3),
    relatability: keywordScore(text, relatabilityTerms, 11, 3)
  };

  const score = Math.round(clamp(Object.values(breakdown).reduce((total, value) => total + value, 0), 0, 100));
  const ageBonus = ageHours < 24 ? 10 : 0;
  const topReplyBonus = post.topReplies.some((reply) => reply.likes >= 50) ? 15 : 0;
  const affiliateBreakdown: AffiliateFitBreakdown = {
    painPointClarity: keywordScore(text, painPointTerms, 25, 2),
    productSolvability: keywordScore(combinedText, productSolvabilityTerms, 25, 2),
    demoPotential: keywordScore(combinedText, demoTerms, 20, 2),
    audienceClarity: post.replies >= 10 ? 20 : keywordScore(text, audienceTerms, 20, 2),
    buyingIntent: keywordScore(combinedText, buyingIntentTerms, 5, 1)
  };
  const excluded = isExcludedPost(text, affiliateBreakdown);
  const affiliateFitScore = excluded
    ? 0
    : Math.round(clamp(affiliateBreakdown.painPointClarity + affiliateBreakdown.productSolvability + (post.replies >= 10 ? 20 : 0) + topReplyBonus + ageBonus + affiliateBreakdown.buyingIntent, 0, 100));
  const videoPotentialScore = Math.round(clamp(
    keywordScore(combinedText, demoTerms, 35, 2) +
      keywordScore(combinedText, emotionalTerms, 25, 2) +
      keywordScore(combinedText, controversialTerms, 15, 2) +
      keywordScore(combinedText, painPointTerms, 25, 2),
    0,
    100
  ));
  const velocityScore = trendVelocityScore(post.trendState);
  const opportunityScore = Math.round(affiliateFitScore * 0.4 + videoPotentialScore * 0.3 + velocityScore * 0.2 + score * 0.1);

  return {
    score,
    affiliateFitScore,
    opportunityScore,
    velocityScore,
    videoPotentialScore,
    engagementGrowthPercent: 0,
    emotionalCategory: detectEmotionalCategory(text),
    breakdown,
    affiliateBreakdown
  };
}

export function trendVelocityScore(state: TrendState) {
  return { EMERGING: 90, GROWING: 75, PEAK: 50, DECLINING: 20, DEAD: 0 }[state];
}

function isExcludedPost(text: string, affiliateBreakdown: AffiliateFitBreakdown) {
  const excludedTerms = ['chinh tri', 'bau cu', 'dich vu te', 'shipper', 'tong dai', 'quang cao', 'booking', 'pr package', 'sponsored'];
  const excluded = excludedTerms.some((term) => text.includes(term));
  return excluded || (affiliateBreakdown.painPointClarity === 0 && affiliateBreakdown.buyingIntent === 0) || affiliateBreakdown.productSolvability === 0;
}

export function detectEmotionalCategory(text: string) {
  const normalized = normalizeText(text);
  let best = { category: 'neutral', hits: 0 };

  for (const [category, terms] of emotionCategories) {
    const hits = terms.filter((term) => normalized.includes(term)).length;
    if (hits > best.hits) best = { category, hits };
  }

  return best.category;
}

function keywordScore(text: string, terms: string[], max: number, fullScoreHits: number) {
  const hits = terms.filter((term) => text.includes(term)).length;
  return clamp((hits / fullScoreHits) * max, 0, max);
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
