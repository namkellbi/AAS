import OpenAI from 'openai';
import type { AIAnalysis, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { getAffiliatePerformanceContext, getOpenAiApiKey, getOpenAiModel, storeAnalysis } from '@/server/db/client';
import { withRetry } from '@/server/utils/withRetry';

export async function analyzeAffiliateOpportunity(post: ThreadsPost): Promise<AIAnalysis> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');

  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0.62,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Bạn là content strategist TikTok affiliate cho thị trường Việt Nam, ưu tiên video kể chuyện tự nhiên phù hợp Gen Z.

Trả về JSON strict, không prose thừa. Chỉ đề xuất sản phẩm vật lý giải quyết trực tiếp pain point và có thể demo trung thực trong video ngắn. Phân loại toàn bộ replies trong cùng một lần trả lời, sau đó chọn 2-6 replies tốt nhất để dựng video. Loại trừ chính trị, phàn nàn dịch vụ, PR brand, claim y tế quá mức, spam, auto-post và tương tác giả.

Quy tắc giọng văn:
- Viết như một người trẻ đang kể lại trải nghiệm hoặc mách bạn bè một món nhỏ hữu ích, không viết như nhân viên sales.
- Phần đầu ưu tiên pain point relatable, lời than vui hoặc cảm giác "đúng là mình"; chỉ giới thiệu sản phẩm sau khi người xem đã hiểu nỗi đau.
- Transition phải giống một phát hiện tự nhiên hoặc một câu chốt dí dỏm, không dùng ngôn ngữ quảng cáo.
- Solution dùng 3-5 câu ngắn: gọi tên sản phẩm một lần, nói cách dùng dễ hình dung, lợi ích có thể demo và tình huống dùng thực tế.
- CTA chỉ 1 câu ngắn, low-pressure, có thể nhắc giỏ hàng nếu phù hợp. Ưu tiên kiểu "ai bị giống tui thì xem thử", không thúc ép.
- Có thể dùng 1-2 cảm thán hoặc từ đời thường như "nha", "thử đi", "nhỏ xíu", "gọn lắm", nhưng không nhồi slang, không giả giọng Gen Z và không dùng từ thô tục.
- Không dùng các câu như "giải pháp tối ưu", "sản phẩm tuyệt vời", "đừng bỏ lỡ", "hãy nhanh tay", "mua ngay", "cam kết", "100%".
- Không bịa tính năng, hiệu quả, giá, khuyến mãi hoặc claim sức khỏe.`
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Phân tích cơ hội affiliate cho thị trường Việt Nam và chuẩn bị dữ liệu dựng TikTok comment compilation.',
            required_schema: {
              verdict: 'make_now | watch | skip',
              confidence_score: '0-100',
              emotion: 'cảm xúc kích hoạt ngắn gọn',
              pain_point: 'pain point cụ thể',
              buying_intent: 'low | medium | high',
              affiliate_fit_score: '0-100',
              personas: ['nhóm người dùng cụ thể'],
              situations: ['tình huống pain point'],
              affiliate_categories: ['danh mục'],
              affiliate_products: ['tên sản phẩm cụ thể'],
              content_angle: 'góc video ngắn',
              demo_angle: 'cách demo trung thực',
              content_format: 'cấu trúc video',
              solution_script: '3-5 câu tiếng Việt tự nhiên như mách bạn bè: sản phẩm, cách dùng, lợi ích demo được, tình huống dùng; không quảng cáo cứng',
              product_search_keywords: ['từ khóa marketplace'],
              script_outline: ['outline có mốc thời gian'],
              why_viral: 'một câu giải thích',
              hooks: ['hook tiếng Việt'],
              ctas: ['CTA tiếng Việt'],
              relatability_score: '0-100',
              controversy_score: '0-100',
              reject_reason: 'null hoặc lý do skip',
              comment_classifications: [{ reply_id: 'id', content: 'reply', type: 'PAIN_POINT | SOCIAL_PROOF | WORKAROUND | OBJECTION | QUESTION | PRODUCT_MENTION', score: '0-100', why_selected: 'lý do ngắn' }],
              best_replies: [{ reply_id: 'id', content: 'reply', type: 'classification', why_selected: 'lý do chọn' }],
              video_potential_score: '0-100',
              video_potential_breakdown: { visual: '0-25', demo: '0-25', emotional: '0-25', curiosity: '0-25' },
              tiktok_caption: 'caption <= 150 ký tự',
              hashtags: ['5-8 hashtag'],
              product_keywords: { tiktok_shop: 'keyword TikTok Shop', shopee: 'keyword Shopee' },
              video_script: {
                post_read_version: 'giữ nguyên nếu <= 200 chữ, nếu dài thì rút gọn khoảng 100 chữ nhưng giữ pain point',
                transition_line: '1-2 câu chuyển từ pain point sang giải pháp, khoảng 8-20 chữ, tự nhiên hoặc dí dỏm',
                solution_text: '3-5 câu giới thiệu giải pháp tự nhiên, cụ thể, demo được; không sale cứng',
                cta_text: 'CTA cuối 1 câu khoảng 8-16 chữ, low-pressure, có thể nhắc xem giỏ hàng',
                caption_variants: ['giật tít', 'storytelling', 'câu hỏi']
              }
            },
            style_reference: {
              purpose: 'Học nhịp kể và mức độ tự nhiên, không sao chép nguyên văn và không mặc định sản phẩm kính.',
              pain_point_story: [
                'Không ai cố tình kéo kính xuống tận mũi cả, kính nó tự tụt xuống.',
                'Mũi thấp và những nỗi đau không lời.',
                'Đẩy kính lên nhiều thì ngại bị soi, không đẩy thì nhìn người ta cũng khó.'
              ],
              transition_example: 'Thực ra tội là do cái kính không có đồ giữ.',
              solution_example: 'Thử gắn bộ gài mắt kính silicone đi. Nhìn nhỏ xíu vậy thôi chứ khá tiện, chỉ cần cài vào chuôi gọng là xong. Lúc vận động hoặc đổ mồ hôi cũng đỡ phải đẩy kính liên tục.',
              cta_example: 'Ai bị giống tui thì xem thử ở giỏ hàng nha.',
              reusable_pattern: [
                'Hook bằng một sự thật đời thường nghe là thấy mình trong đó.',
                'Đọc post và reply như chuỗi đồng cảm, có thể hơi hài.',
                'Transition chốt lại nguyên nhân hoặc mở ra cách xử lý.',
                'Giới thiệu một món nhỏ, cách dùng đơn giản, lợi ích nhìn thấy được.',
                'CTA ngắn như lời rủ thử, không ép mua.'
              ]
            },
            channel_performance_history: getAffiliatePerformanceContext(),
            performance_instruction: 'Nếu lịch sử có dữ liệu, ưu tiên các kiểu hook, format hoặc nhóm sản phẩm từng tạo click, đơn hoặc hoa hồng. Không sao chép máy móc và không bỏ qua độ phù hợp với bài hiện tại.',
            post: {
              content: post.content,
              author: post.author,
              likes: post.likes,
              replies: post.replies,
              reposts: post.reposts,
              timestamp: post.timestamp,
              trend_state: post.trendState,
              likes_per_hour: post.likesPerHour,
              replies_per_hour: post.repliesPerHour,
              trending_score: post.trendingScore,
              local_affiliate_fit_score: post.affiliateFitScore,
              local_opportunity_score: post.opportunityScore,
              emotional_category: post.emotionalCategory,
              top_replies: post.topReplies
            }
          })
        }
      ]
    })
  );
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
    const response = await withRetry(() =>
      client.chat.completions.create({
        model: getOpenAiModel(),
        temperature: 0,
        max_tokens: 12,
        messages: [{ role: 'user', content: 'Return exactly: ok' }]
      })
    );
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
    whyViral: stringValue(parsed.why_viral, 'Bài viết nêu một tình huống cụ thể và dễ đồng cảm.'),
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
    commentClassifications: normalizeClassifications(parsed.comment_classifications),
    bestReplies: normalizeBestReplies(parsed.best_replies),
    videoPotentialScore: numberValue(parsed.video_potential_score, 0),
    videoPotentialBreakdown: normalizeVideoPotentialBreakdown(parsed.video_potential_breakdown),
    tiktokCaption: stringValue(parsed.tiktok_caption, ''),
    hashtags: stringArray(parsed.hashtags).slice(0, 8),
    marketplaceKeywords: normalizeProductKeywords(parsed.product_keywords),
    videoScript: normalizeVideoScript(parsed.video_script, parsed.solution_script),
    createdAt: nowIso()
  };
}

function normalizeClassifications(value: unknown): AIAnalysis['commentClassifications'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = objectValue(item);
      return { replyId: stringValue(record.reply_id, ''), content: stringValue(record.content, ''), type: classificationType(record.type), score: numberValue(record.score, 0), whySelected: stringValue(record.why_selected, '') };
    })
    .filter((item) => item.content)
    .slice(0, 10);
}

function normalizeBestReplies(value: unknown): AIAnalysis['bestReplies'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = objectValue(item);
      return { id: optionalString(record.reply_id), content: stringValue(record.content, ''), type: stringValue(record.type, 'PAIN_POINT'), whySelected: stringValue(record.why_selected, '') };
    })
    .filter((item) => item.content)
    .slice(0, 6);
}

function normalizeVideoPotentialBreakdown(value: unknown): AIAnalysis['videoPotentialBreakdown'] {
  const record = objectValue(value);
  return { visual: numberValue(record.visual, 0, 25), demo: numberValue(record.demo, 0, 25), emotional: numberValue(record.emotional, 0, 25), curiosity: numberValue(record.curiosity, 0, 25) };
}

function normalizeProductKeywords(value: unknown): AIAnalysis['marketplaceKeywords'] {
  const record = objectValue(value);
  return { tiktokShop: stringValue(record.tiktok_shop, ''), shopee: stringValue(record.shopee, '') };
}

function normalizeVideoScript(value: unknown, fallbackSolution: unknown): AIAnalysis['videoScript'] {
  const record = objectValue(value);
  return {
    postReadVersion: stringValue(record.post_read_version, ''),
    transitionLine: stringValue(record.transition_line, ''),
    solutionText: stringValue(record.solution_text, stringValue(fallbackSolution, '')),
    ctaText: stringValue(record.cta_text, ''),
    captionVariants: stringArray(record.caption_variants).slice(0, 3)
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function classificationType(value: unknown): AIAnalysis['commentClassifications'][number]['type'] {
  return value === 'SOCIAL_PROOF' || value === 'WORKAROUND' || value === 'OBJECTION' || value === 'QUESTION' || value === 'PRODUCT_MENTION' ? value : 'PAIN_POINT';
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

function numberValue(value: unknown, fallback: number, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number), 0), max) : fallback;
}

function buyingIntentValue(value: unknown): AIAnalysis['buyingIntent'] {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function verdictValue(value: unknown, affiliateFitScore: unknown): AIAnalysis['verdict'] {
  if (value === 'make_now' || value === 'watch' || value === 'skip') return value;
  const fit = numberValue(affiliateFitScore, 0);
  return fit >= 72 ? 'make_now' : fit >= 45 ? 'watch' : 'skip';
}
