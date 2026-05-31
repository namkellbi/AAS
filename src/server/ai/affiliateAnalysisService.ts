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
          'Bạn phân tích bài Threads công khai cho affiliate marketing tại Việt Nam. Chỉ đề xuất sản phẩm giải quyết trực tiếp pain point và có thể minh họa trung thực trong video ngắn. Không đề xuất spam, tự động đăng bài, tương tác giả, claim y tế quá mức hoặc automation vi phạm chính sách. Trả về JSON ngắn gọn bằng tiếng Việt.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Phân tích bài Threads này để tìm cơ hội affiliate phù hợp thị trường Việt Nam. Nếu bài viral nhưng không có sản phẩm giải quyết hợp lý, hãy cho affiliate_fit_score thấp và nêu reject_reason.',
          requiredSchema: {
            verdict: 'make_now | watch | skip',
            confidence_score: '0-100, độ tự tin của verdict',
            emotion: 'cảm xúc kích hoạt ngắn gọn',
            pain_point: 'pain point cụ thể',
            buying_intent: 'low | medium | high',
            affiliate_fit_score: '0-100, khả năng chuyển thành nội dung affiliate bán hàng',
            personas: ['nhóm người dùng cụ thể'],
            situations: ['tình huống thực tế làm pain point xuất hiện'],
            affiliate_categories: ['danh mục'],
            affiliate_products: ['sản phẩm cụ thể có thể tìm trên marketplace Việt Nam'],
            content_angle: 'góc TikTok/Reels ngắn',
            demo_angle: 'cách quay demo trước và sau khi dùng sản phẩm',
            content_format: 'cấu trúc video, ví dụ: hook pain point -> khuếch đại -> demo giải pháp -> CTA',
            solution_script: 'đoạn voiceover giải pháp 2-4 câu bằng tiếng Việt Gen Z tự nhiên, trẻ trung, có cảm thán vừa phải; nêu đúng sản phẩm và cách dùng; nghe như chia sẻ mẹo hữu ích, không như quảng cáo đọc kịch bản; không claim quá mức',
            product_search_keywords: ['từ khóa ngắn gọn để tìm sản phẩm trên marketplace Việt Nam'],
            script_outline: ['outline video có mốc thời gian, ví dụ: 0:00-0:03 hook pain point'],
            why_viral: 'một câu giải thích',
            hooks: ['hook tiếng Việt ngắn, tự nhiên, không copy nguyên văn bài gốc'],
            ctas: ['CTA tiếng Việt ngắn, không gây hiểu nhầm'],
            relatability_score: '0-100',
            controversy_score: '0-100',
            reject_reason: 'null nếu phù hợp; lý do nếu không nên làm affiliate'
          },
          post: {
            content: post.content,
            author: post.author,
            likes: post.likes,
            replies: post.replies,
            reposts: post.reposts,
            timestamp: post.timestamp,
            trendingScore: post.trendingScore,
            localAffiliateFitScore: post.affiliateFitScore,
            localOpportunityScore: post.opportunityScore,
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
    verdict: verdictValue(parsed.verdict, parsed.affiliate_fit_score),
    confidenceScore: numberValue(parsed.confidence_score, 70),
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
    affiliateFitScore: numberValue(parsed.affiliate_fit_score, 0),
    personas: stringArray(parsed.personas).slice(0, 6),
    situations: stringArray(parsed.situations).slice(0, 8),
    demoAngle: stringValue(parsed.demo_angle, ''),
    contentFormat: stringValue(parsed.content_format, ''),
    solutionScript: stringValue(parsed.solution_script, ''),
    productSearchKeywords: stringArray(parsed.product_search_keywords).slice(0, 8),
    scriptOutline: stringArray(parsed.script_outline).slice(0, 8),
    rejectReason: optionalString(parsed.reject_reason),
    createdAt: nowIso()
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number), 0), 100) : fallback;
}

function buyingIntentValue(value: unknown): AIAnalysis['buyingIntent'] {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function verdictValue(value: unknown, affiliateFitScore: unknown): AIAnalysis['verdict'] {
  if (value === 'make_now' || value === 'watch' || value === 'skip') return value;
  const fit = numberValue(affiliateFitScore, 0);
  return fit >= 72 ? 'make_now' : fit >= 45 ? 'watch' : 'skip';
}
