import type { ThreadsPost, ViralScoreBreakdown } from '@/lib/types';
import { clamp } from '@/lib/utils';

const emotionalTerms = [
  'struggle',
  'hate',
  'embarrassing',
  'insecure',
  'anxious',
  'tired',
  'pain',
  'annoying',
  'worst',
  'need',
  'finally',
  'wish',
  'afraid',
  'awkward'
];

const controversialTerms = [
  'unpopular opinion',
  'hot take',
  'nobody talks about',
  'stop',
  'never',
  'always',
  'everyone',
  'people with',
  'normalize',
  'overrated'
];

const relatabilityTerms = [
  'people with',
  'anyone else',
  'no one tells you',
  'when you',
  'always',
  'every time',
  'why is it',
  'the worst part',
  'i can’t be the only one',
  'lowkey'
];

const emotionCategories: Array<[string, string[]]> = [
  ['insecurity', ['insecure', 'embarrassing', 'ugly', 'body', 'face', 'nose', 'skin']],
  ['frustration', ['annoying', 'hate', 'struggle', 'why is it', 'worst', 'tired']],
  ['anxiety', ['anxious', 'afraid', 'worried', 'panic', 'not knowing']],
  ['aspiration', ['wish', 'finally', 'dream', 'upgrade', 'better']],
  ['fatigue', ['sleep', 'tired', 'exhausted', 'burnout', 'drained']]
];

export function scorePost(post: Omit<ThreadsPost, 'trendingScore' | 'emotionalCategory'>): {
  score: number;
  emotionalCategory: string;
  breakdown: ViralScoreBreakdown;
} {
  const ageHours = Math.max((Date.now() - new Date(post.timestamp).getTime()) / 36e5, 0.5);
  const engagement = post.likes + post.replies * 3 + post.reposts * 4;
  const perHour = engagement / ageHours;
  const text = post.content.toLowerCase();

  const breakdown: ViralScoreBreakdown = {
    likesVelocity: clamp(Math.log10(perHour + 1) * 18, 0, 25),
    replies: clamp(Math.log10(post.replies + 1) * 9, 0, 18),
    reposts: clamp(Math.log10(post.reposts + 1) * 10, 0, 20),
    emotionalWording: keywordScore(text, emotionalTerms, 14),
    controversialWording: keywordScore(text, controversialTerms, 12),
    relatability: keywordScore(text, relatabilityTerms, 11)
  };

  const score = Math.round(
    clamp(
      breakdown.likesVelocity +
        breakdown.replies +
        breakdown.reposts +
        breakdown.emotionalWording +
        breakdown.controversialWording +
        breakdown.relatability,
      0,
      100
    )
  );

  return {
    score,
    emotionalCategory: detectEmotionalCategory(text),
    breakdown
  };
}

export function detectEmotionalCategory(text: string) {
  const normalized = text.toLowerCase();
  let best = { category: 'neutral', hits: 0 };

  for (const [category, terms] of emotionCategories) {
    const hits = terms.filter((term) => normalized.includes(term)).length;
    if (hits > best.hits) {
      best = { category, hits };
    }
  }

  return best.category;
}

function keywordScore(text: string, terms: string[], max: number) {
  const hits = terms.filter((term) => text.includes(term)).length;
  return clamp((hits / Math.max(terms.length / 3, 1)) * max, 0, max);
}
