import OpenAI from 'openai';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { getOpenAiApiKey, getOpenAiModel, storeAnalysis } from '@/server/db/client';

export async function analyzeAffiliateOpportunity(post: ThreadsPost): Promise<AIAnalysis> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: getOpenAiModel(),
    temperature: 0.35,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You analyze public Threads posts for affiliate marketing research. Do not suggest spam, auto-posting, fake engagement, or policy-violating automation. Return compact JSON only.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Analyze this Threads post for viral mechanics and suitable affiliate product ideas.',
          requiredSchema: {
            emotion: 'short emotional trigger',
            pain_point: 'specific pain point',
            buying_intent: 'low | medium | high',
            affiliate_categories: ['category'],
            affiliate_products: ['specific product idea'],
            content_angle: 'short TikTok/Reels angle',
            why_viral: 'one sentence',
            hooks: ['short hook'],
            ctas: ['short CTA'],
            relatability_score: '0-100',
            controversy_score: '0-100'
          },
          post: {
            content: post.content,
            author: post.author,
            likes: post.likes,
            replies: post.replies,
            reposts: post.reposts,
            timestamp: post.timestamp,
            trendingScore: post.trendingScore,
            emotionalCategory: post.emotionalCategory
          }
        })
      }
    ]
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const analysis = normalizeAnalysis(post.id, parsed);
  storeAnalysis(analysis);
  return analysis;
}

export async function testOpenAIConnection() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return { ok: false, message: 'OpenAI API key is missing.' };

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0,
      max_tokens: 12,
      messages: [{ role: 'user', content: 'Return exactly: ok' }]
    });
    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return { ok: text.toLowerCase().includes('ok'), message: `OpenAI responded using ${getOpenAiModel()}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeAnalysis(postId: string, parsed: Record<string, unknown>): AIAnalysis {
  return {
    postId,
    emotion: stringValue(parsed.emotion, 'curiosity'),
    painPoint: stringValue(parsed.pain_point, 'unclear pain point'),
    buyingIntent: buyingIntentValue(parsed.buying_intent),
    affiliateCategories: stringArray(parsed.affiliate_categories).slice(0, 6),
    affiliateProducts: stringArray(parsed.affiliate_products).slice(0, 8),
    contentAngle: stringValue(parsed.content_angle, 'relatable product discovery'),
    whyViral: stringValue(parsed.why_viral, 'The post is short, specific, and easy to recognize.'),
    hooks: stringArray(parsed.hooks).slice(0, 6),
    ctas: stringArray(parsed.ctas).slice(0, 6),
    relatabilityScore: numberValue(parsed.relatability_score, 70),
    controversyScore: numberValue(parsed.controversy_score, 10),
    createdAt: nowIso()
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number), 0), 100) : fallback;
}

function buyingIntentValue(value: unknown): AIAnalysis['buyingIntent'] {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}
