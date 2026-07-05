import OpenAI from 'openai';
import type { KeywordDiscoveryRequest, KeywordDiscoveryResult, KeywordSuggestion } from '@/lib/types';
import { getAffiliatePerformanceContext, getOpenAiApiKey, getOpenAiModel, listAnalyses, listKeywordExclusions, listPosts, logApiUsage } from '@/server/db/client';
import { withRetry } from '@/server/utils/withRetry';

export async function discoverAffiliateKeywords(request: KeywordDiscoveryRequest): Promise<KeywordDiscoveryResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OpenAI API key is missing. Add it in Settings before asking AI for keywords.');

  const analyses = new Map(listAnalyses(160).map((analysis) => [analysis.postId, analysis]));
  const winningPosts = listPosts(160)
    .map((post) => ({ post, analysis: analyses.get(post.id) }))
    .filter(({ post, analysis }) => analysis?.verdict === 'make_now' || (analysis?.verdict === 'watch' && post.opportunityScore >= 60))
    .sort((a, b) => (b.analysis?.confidenceScore ?? 0) + b.post.opportunityScore - ((a.analysis?.confidenceScore ?? 0) + a.post.opportunityScore))
    .slice(0, 12)
    .map(({ post, analysis }) => ({
      keyword: post.keyword,
      content: post.content.slice(0, 500),
      pain_point: analysis?.painPoint,
      products: analysis?.affiliateProducts.slice(0, 3),
      replies: post.topReplies.slice(0, 3).map((reply) => reply.content)
    }));
  const performance = getAffiliatePerformanceContext().slice(0, 8);
  const exclusions = listKeywordExclusions().map((item) => item.phrase);
  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0.72,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Bạn là researcher cho TikTok affiliate tại Việt Nam.
Hãy đề xuất các cụm từ người Việt thực sự có thể viết trên Threads khi đang than phiền, hỏi kinh nghiệm hoặc tìm cách giải quyết một vấn đề.

Quy tắc:
- Ưu tiên pain point có thể giải quyết bằng sản phẩm vật lý giá dễ mua và demo được trong video ngắn.
- Cụm từ dài 2-7 từ, tự nhiên, không dùng hashtag và không chỉ ghi tên danh mục rộng.
- Viết như cụm từ thật người Việt có thể dùng trên Threads: lời than, câu hỏi, tình huống hoặc nhu cầu.
- Nếu có dữ liệu bài tốt hoặc video có đơn, khai thác pattern mới gần với tín hiệu đó nhưng không lặp nguyên từ khóa cũ.
- Tránh claim y tế, tài chính, chính trị, nội dung nhạy cảm hoặc sản phẩm khó chứng minh.
- Không lặp lại danh sách từ khóa hiện có.
- Không chứa bất kỳ cụm từ loại trừ nào.
- Trả JSON strict: {"suggestions":[{"phrase":"...","pain_point":"...","reason":"...","evidence":"audience | post signal | sales signal"}]}.`
        },
        {
          role: 'user',
          content: JSON.stringify({
            market: 'Việt Nam',
            discovery_mode: request.mode,
            audience: request.audienceLabel,
            seed: request.seed?.trim() || 'đời sống, làm đẹp, công sở, đồ gia dụng',
            existing_keywords: request.existingKeywords,
            excluded_terms: exclusions,
            strong_post_signals: winningPosts,
            channel_sales_signals: performance,
            count: 10
          })
        }
      ]
    })
  );

  if (response.usage) {
    logApiUsage({ kind: 'keyword_discovery', model: getOpenAiModel(), inputUnits: response.usage.prompt_tokens, outputUnits: response.usage.completion_tokens });
  }
  const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
  const items = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const existingSet = new Set(request.existingKeywords.map((item) => item.trim().toLowerCase()));
  const exclusionSet = exclusions.map((item) => item.toLowerCase());
  const seen = new Set<string>();

  const suggestions = items
    .map((item) => {
      const record = objectValue(item);
      return {
        phrase: stringValue(record.phrase),
        painPoint: stringValue(record.pain_point),
        reason: stringValue(record.reason),
        evidence: stringValue(record.evidence)
      };
    })
    .filter((item) => {
      const normalized = item.phrase.toLowerCase();
      if (!item.phrase || existingSet.has(normalized) || seen.has(normalized) || exclusionSet.some((term) => normalized.includes(term))) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 10);

  return {
    suggestions,
    postsUsed: winningPosts.length,
    winnersUsed: performance.filter((item) => item.orders > 0 || item.commission > 0).length
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
