import OpenAI from 'openai';
import type { AIAnalysis, ContentGoal, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { getAffiliatePerformanceContext, getOpenAiApiKey, getOpenAiModel, listProducts, logApiUsage, storeAnalysis } from '@/server/db/client';
import { withRetry } from '@/server/utils/withRetry';

const spokenRewriteRules = `Quy tắc spoken rewrite (bắt buộc cho mọi field trong video_script — đây là văn NÓI để TTS đọc thành tiếng, không phải văn viết):
- Câu ngắn dưới 15 từ. Ngắt ý bằng dấu chấm, không dùng câu dài nhiều dấu phẩy.
- Thêm từ đệm khẩu ngữ tự nhiên khi hợp ngữ cảnh: "thật sự là", "kiểu", "mọi người biết không", "nghe xong mà".
- Tuyệt đối không hashtag, không emoji, không viết tắt kiểu "ko", "sml", "r"; đọc số thành chữ (ví dụ "30k" thành "ba mươi nghìn", "SPF50" thành "năm mươi SPF").
- Mở đầu xưng hô trực tiếp với người xem, ví dụ "mọi người", "bạn nào mà...".
- Đọc lên phải nghe như một người đang kể chuyện cho bạn thân, không như đang đọc lại một bài đăng. Học theo spoken_rewrite_examples trong dữ liệu.`;

const affiliateSystemPrompt = `Bạn là content strategist TikTok affiliate cho thị trường Việt Nam, ưu tiên video kể chuyện tự nhiên phù hợp Gen Z.

Trả về JSON strict, không prose thừa. Chỉ đề xuất sản phẩm vật lý giải quyết trực tiếp pain point và có thể demo trung thực trong video ngắn. Phân loại toàn bộ replies trong cùng một lần trả lời, sau đó chọn 2-6 replies tốt nhất để dựng video. Loại trừ chính trị, phàn nàn dịch vụ, PR brand, claim y tế quá mức, spam, auto-post và tương tác giả.

Quy tắc giọng văn:
- Viết như một người trẻ đang kể lại trải nghiệm hoặc mách bạn bè một món nhỏ hữu ích, không viết như nhân viên sales.
- Phần đầu ưu tiên pain point relatable, lời than vui hoặc cảm giác "đúng là mình"; chỉ giới thiệu sản phẩm sau khi người xem đã hiểu nỗi đau.
- Transition phải giống một phát hiện tự nhiên hoặc một câu chốt dí dỏm, không dùng ngôn ngữ quảng cáo.
- Solution dùng 3-5 câu ngắn: gọi tên sản phẩm một lần, nói cách dùng dễ hình dung, lợi ích có thể demo và tình huống dùng thực tế.
- CTA chỉ 1 câu ngắn, low-pressure, có thể nhắc giỏ hàng nếu phù hợp. Ưu tiên kiểu "ai bị giống tui thì xem thử", không thúc ép.
- Có thể dùng 1-2 cảm thán hoặc từ đời thường như "nha", "thử đi", "nhỏ xíu", "gọn lắm", nhưng không nhồi slang, không giả giọng Gen Z và không dùng từ thô tục.
- Không dùng các câu như "giải pháp tối ưu", "sản phẩm tuyệt vời", "đừng bỏ lỡ", "hãy nhanh tay", "mua ngay", "cam kết", "100%".
- Không bịa tính năng, hiệu quả, giá, khuyến mãi hoặc claim sức khỏe.

Quy tắc product catalog:
- Nếu product_catalog trong dữ liệu KHÔNG rỗng: ưu tiên góc nội dung khớp với một sản phẩm thật trong catalog và trả matched_product_id đúng bằng id của sản phẩm đó.
- Nếu không có sản phẩm nào trong catalog thật sự khớp pain point thì matched_product_id = null. TUYỆT ĐỐI không bịa id hoặc sản phẩm ngoài catalog.

${spokenRewriteRules}`;

const engagementSystemPrompt = `Bạn là chuyên gia nuôi kênh TikTok cho thị trường Việt Nam trong giai đoạn xây follow, ưu tiên video kể chuyện gây đồng cảm và kéo tương tác.

Trả về JSON strict, không prose thừa. Mục tiêu là ENGAGEMENT, không phải bán hàng: đánh giá comment-bait potential (bài này có khiến người xem muốn kể câu chuyện của chính mình không), chất lượng câu chuyện và độ relatable. TUYỆT ĐỐI không pitch sản phẩm, không CTA mua hàng; các field affiliate_categories, affiliate_products, product_search_keywords, product_keywords để rỗng. Verdict vẫn là make_now/watch/skip nhưng chấm theo tiêu chí engagement: câu chuyện mạnh, dễ đồng cảm, dễ kéo comment và share. Phân loại toàn bộ replies trong cùng một lần trả lời, sau đó chọn 2-6 replies tốt nhất để dựng video. Loại trừ chính trị, phàn nàn dịch vụ, PR brand, claim y tế quá mức, spam.

Quy tắc giọng văn:
- Viết như một người trẻ kể lại một chuyện đời thường khiến ai nghe cũng thấy mình trong đó.
- Phần đầu ưu tiên cảm giác "đúng là mình", lời than vui hoặc một sự thật ít ai nói ra.
- solution_text là lời chốt câu chuyện: một góc nhìn, một bài học nhỏ hoặc một câu hỏi mở — KHÔNG nhắc tới bất kỳ sản phẩm nào.
- CTA cuối là câu hỏi kéo comment ("còn mọi người thì sao?") hoặc lời rủ follow nhẹ nhàng, không thúc ép.
- Có thể dùng 1-2 cảm thán hoặc từ đời thường, không nhồi slang, không giả giọng Gen Z, không từ thô tục.

${spokenRewriteRules}`;

export async function analyzeAffiliateOpportunity(post: ThreadsPost, goal: ContentGoal = 'affiliate'): Promise<AIAnalysis> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before running AI analysis.');

  const catalog = goal === 'affiliate' ? listProducts('active') : [];
  const catalogIds = new Set(catalog.map((product) => product.id));
  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0.62,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: goal === 'engagement' ? engagementSystemPrompt : affiliateSystemPrompt
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              goal === 'engagement'
                ? 'Đánh giá tiềm năng ENGAGEMENT (nuôi kênh, kéo comment/follow, không gắn sản phẩm) và chuẩn bị dữ liệu dựng TikTok comment compilation.'
                : 'Phân tích cơ hội affiliate cho thị trường Việt Nam và chuẩn bị dữ liệu dựng TikTok comment compilation.',
            content_goal: goal,
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
              ctas: goal === 'engagement' ? ['câu hỏi cuối video kéo comment hoặc lời rủ follow, tiếng Việt'] : ['CTA tiếng Việt'],
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
              matched_product_id: 'id của sản phẩm trong product_catalog nếu khớp pain point, ngược lại null — không được bịa',
              video_script: {
                post_read_version: 'viết lại bài post thành văn NÓI để TTS đọc: giữ pain point, câu ngắn dưới 15 từ, bỏ hashtag/emoji/viết tắt, đọc số thành chữ; nếu bài dài hơn 200 chữ thì rút còn khoảng 100 chữ',
                transition_line: goal === 'engagement' ? '1-2 câu văn nói chuyển từ câu chuyện sang phần chốt, khoảng 8-20 chữ, tự nhiên hoặc dí dỏm' : '1-2 câu văn nói chuyển từ pain point sang giải pháp, khoảng 8-20 chữ, tự nhiên hoặc dí dỏm',
                solution_text: goal === 'engagement' ? '2-4 câu văn nói chốt câu chuyện: góc nhìn hoặc bài học nhỏ, KHÔNG nhắc sản phẩm' : '3-5 câu văn nói ngắn giới thiệu giải pháp tự nhiên, cụ thể, demo được; không sale cứng',
                cta_text: goal === 'engagement' ? 'câu hỏi cuối video kéo comment hoặc lời rủ follow, 1 câu văn nói khoảng 8-16 chữ' : 'CTA cuối 1 câu văn nói khoảng 8-16 chữ, low-pressure, có thể nhắc xem giỏ hàng',
                caption_variants: ['giật tít', 'storytelling', 'câu hỏi']
              }
            },
            spoken_rewrite_examples: [
              {
                written: 'Mình đã mua 3 loại kem chống nắng SPF50+ mà da vẫn đổ dầu 😭 #skincare #dadau',
                spoken: 'Mọi người biết không. Tui mua tận ba loại kem chống nắng rồi. Loại nào cũng năm mươi SPF trở lên. Mà mặt vẫn đổ dầu như thường.'
              },
              {
                written: 'Deadline dí sml, 11h đêm vẫn ngồi cty, lương thì 8tr :)))',
                spoken: 'Thật sự là deadline dí muốn xỉu luôn á. Mười một giờ đêm vẫn ngồi ở công ty. Mà lương thì có tám triệu thôi mọi người.'
              },
              {
                written: 'Ai có tips trị thâm mụn ko? Thử 7749 cách r mà vẫn vậy',
                spoken: 'Bạn nào có cách trị thâm mụn không. Tui thử kiểu cả trăm cách rồi. Mà nghe xong đừng cười nha. Vẫn y như cũ.'
              }
            ],
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
            product_catalog: catalog.map((product) => ({
              id: product.id,
              name: product.name,
              category: product.category,
              price: product.price,
              commission_percent: product.commissionPercent,
              marketplace: product.marketplace
            })),
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
  if (response.usage) {
    logApiUsage({ kind: 'analysis', model: getOpenAiModel(), inputUnits: response.usage.prompt_tokens, outputUnits: response.usage.completion_tokens, relatedPostId: post.id });
  }
  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const analysis = normalizeAnalysis(post.id, parsed, goal, catalogIds);
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

function normalizeAnalysis(postId: string, parsed: Record<string, unknown>, goal: ContentGoal = 'affiliate', catalogIds: Set<string> = new Set()): AIAnalysis {
  const matchedProductId = optionalString(parsed.matched_product_id);
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
    contentGoal: goal,
    matchedProductId: matchedProductId && catalogIds.has(matchedProductId) ? matchedProductId : undefined,
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
