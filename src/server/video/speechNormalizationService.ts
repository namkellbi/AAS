import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { normalizeVietnameseForSpeech } from '@/lib/vietnamese-speech';
import { checkDailyQuota, logApiUsage } from '@/server/db/client';
import { withRetry } from '@/server/utils/withRetry';

const normalizationModel = 'gpt-4.1-nano';
const normalizationVersion = 'vi-social-speech-v3-contextual-typos';

export async function normalizeVietnameseSpeechBatch(inputs: string[], apiKey: string, relatedPostId?: string) {
  const local = inputs.map((input) => normalizeVietnameseForSpeech(input));
  if (!apiKey.trim() || !local.some(Boolean) || checkDailyQuota().exceeded) return local;

  const cacheDir = path.resolve(process.cwd(), 'data', 'speech-normalization-cache');
  const cacheKey = crypto
    .createHash('sha256')
    .update(JSON.stringify({ version: normalizationVersion, inputs, local }))
    .digest('hex');
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as string[];
      if (cached.length === inputs.length && cached.every((item) => typeof item === 'string' && item.trim())) return cached;
    } catch {
      // Regenerate a broken cache entry.
    }
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await withRetry(() =>
      client.chat.completions.create({
        model: normalizationModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Bạn là bộ chuẩn hóa lời đọc TTS tiếng Việt cho bình luận mạng xã hội của người trẻ Việt Nam.
Dựa vào TOÀN BỘ NGỮ CẢNH của mỗi câu để:
- Chuyển cách viết tắt, teencode, tiếng lóng, ký hiệu, số và từ vay mượn thành cách đọc tự nhiên.
- Sửa lỗi gõ phím hoặc thiếu dấu HIỂN NHIÊN khi ngữ cảnh chỉ có một cách hiểu hợp lý.
- Phân biệt cùng một chữ viết tắt theo ngữ cảnh; không dùng một phép thay thế máy móc cho mọi câu.
Không rewrite, không tóm tắt, không lịch sự hóa, không thêm ý, không đổi đại từ hay sắc thái thô/tếu của bản gốc.
Giữ nguyên từ tục và mức độ cảm xúc. Ví dụ "đ" trong câu chửi/phủ định suồng sã có thể là "đéo", không đọc tên chữ cái "đờ".
Nếu một typo hoặc viết tắt còn mơ hồ, giữ nguyên thay vì đoán.
Giữ nguyên thứ tự ý và dấu câu. Không chèn dấu câu mới giữa các từ vốn đang viết liền trong cùng một cụm.
Ví dụ:
- "nch bcuoi vcl" -> "nói chuyện buồn cười vờ cờ lờ"
- "Duma bcuoi v :))" -> "đù má buồn cười vãi"
- "chx bt" -> "chưa biết"
- "cái nhìn của ng lớn" -> "cái nhìn của người lớn"
- "đúng không ngỉ" -> "đúng không nhỉ"
- "t đ quan tâm" -> "tao đéo quan tâm"
Trả JSON đúng dạng {"items":[{"index":0,"spoken":"..."}]}.`
          },
          {
            role: 'user',
            content: JSON.stringify({
              items: inputs.map((original, index) => ({
                index,
                original,
                local_normalization: local[index]
              }))
            })
          }
        ]
      })
    );
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      items?: Array<{ index?: unknown; spoken?: unknown }>;
    };
    const normalized = [...local];
    for (const item of parsed.items ?? []) {
      const index = Number(item.index);
      const spoken = typeof item.spoken === 'string' ? item.spoken.trim() : '';
      if (!Number.isInteger(index) || index < 0 || index >= inputs.length || !isSafeSpeechNormalization(inputs[index], spoken)) continue;
      normalized[index] = spoken;
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(normalized), 'utf8');
    if (response.usage) {
      logApiUsage({
        kind: 'analysis',
        model: normalizationModel,
        inputUnits: response.usage.prompt_tokens,
        outputUnits: response.usage.completion_tokens,
        relatedPostId
      });
    }
    return normalized;
  } catch {
    return local;
  }
}

function isSafeSpeechNormalization(original: string, spoken: string) {
  if (!spoken || spoken.length > Math.max(original.length * 4, original.length + 160)) return false;
  const originalPunctuation = (original.match(/[.!?;:,\n]/g) ?? []).length;
  const spokenPunctuation = (spoken.match(/[.!?;:,\n]/g) ?? []).length;
  return spokenPunctuation <= originalPunctuation + 2;
}
