import crypto from 'node:crypto';
import OpenAI from 'openai';
import type { SpeechNormalizationRequest, SpeechNormalizationResult, SpeechNormalizationSegment } from '@/lib/types';
import { getDb, getOpenAiApiKey, getOpenAiModel, logApiUsage } from '@/server/db/client';
import { TTS_NORMALIZATION_INSTRUCTIONS, TTS_NORMALIZATION_PROMPT_VERSION } from '@/server/ai/ttsNormalizationPrompt';
import { getCodexNormalizationStatus, normalizeWithCodex } from '@/server/ai/codexNormalizationService';
import { withRetry } from '@/server/utils/withRetry';

const MAX_SEGMENTS = 24;
const MAX_TOTAL_CHARACTERS = 40_000;

const normalizationSchema = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['id', 'text'],
        additionalProperties: false
      }
    }
  },
  required: ['segments'],
  additionalProperties: false
} as const;

export async function normalizeSpeechSegments(request: SpeechNormalizationRequest): Promise<SpeechNormalizationResult> {
  const segments = validateInputSegments(request.segments);
  const apiKey = getOpenAiApiKey();
  const inputJson = JSON.stringify({ segments });
  const codexStatus = await getCodexNormalizationStatus();
  let codexError: unknown;

  if (codexStatus.codexLoggedIn) {
    const model = 'codex-chatgpt';
    const cacheKey = createCacheKey(model, inputJson);
    const cached = readCachedResult(cacheKey, segments);
    if (cached) {
      return { segments: cached, model, provider: 'codex', cached: true, inputTokens: 0, outputTokens: 0 };
    }
    try {
      const normalized = validateOutputSegments(await normalizeWithCodex(segments), segments);
      writeCachedResult(cacheKey, model, inputJson, normalized);
      return { segments: normalized, model, provider: 'codex', cached: false, inputTokens: 0, outputTokens: 0 };
    } catch (error) {
      codexError = error;
    }
  }

  if (!apiKey) {
    if (codexError) {
      const detail = codexError instanceof Error ? codexError.message : String(codexError);
      throw new Error(`${detail} Chưa có OpenAI API key để chạy dự phòng.`);
    }
    throw new Error('Codex chưa đăng nhập ChatGPT và chưa cấu hình OpenAI API key dự phòng.');
  }

  const model = getOpenAiModel();
  const cacheKey = createCacheKey(model, inputJson);
  const cached = readCachedResult(cacheKey, segments);
  if (cached) {
    return { segments: cached, model, provider: 'openai', cached: true, inputTokens: 0, outputTokens: 0 };
  }

  const client = new OpenAI({ apiKey });
  const response = await withRetry(() => client.responses.create({
    model,
    instructions: TTS_NORMALIZATION_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Chuẩn hóa từng text cho TTS. Giữ nguyên tuyệt đối id, số lượng và thứ tự segment.',
              'Chỉ xuất dữ liệu theo JSON schema.',
              inputJson
            ].join('\n\n')
          }
        ]
      }
    ],
    temperature: 0,
    max_output_tokens: 8_000,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'tts_normalization',
        description: 'Các phân đoạn tiếng Việt đã được chuẩn hóa cho TTS.',
        strict: true,
        schema: normalizationSchema
      }
    }
  }), 2);

  if (response.status !== 'completed') {
    throw new Error(`OpenAI chưa hoàn tất chuẩn hóa (trạng thái: ${response.status}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error('OpenAI trả về dữ liệu không đọc được. Nội dung gốc vẫn được giữ nguyên.');
  }

  const normalized = validateOutputSegments(parsed, segments);
  writeCachedResult(cacheKey, model, inputJson, normalized);
  if (response.usage) {
    logApiUsage({
      kind: 'normalization',
      model,
      inputUnits: response.usage.input_tokens,
      outputUnits: response.usage.output_tokens,
      relatedPostId: request.relatedPostId
    });
  }

  return {
    segments: normalized,
    model,
    provider: 'openai',
    cached: false,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0
  };
}

export function validateInputSegments(value: unknown): SpeechNormalizationSegment[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SEGMENTS) {
    throw new Error(`Transcript cần từ 1 đến ${MAX_SEGMENTS} phân đoạn.`);
  }

  const segments = value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Phân đoạn ${index + 1} không hợp lệ.`);
    const id = 'id' in item && typeof item.id === 'string' ? item.id.trim() : '';
    const text = 'text' in item && typeof item.text === 'string' ? item.text.trim() : '';
    if (!id || !text) throw new Error(`Phân đoạn ${index + 1} thiếu id hoặc nội dung.`);
    return { id, text };
  });

  if (new Set(segments.map((item) => item.id)).size !== segments.length) {
    throw new Error('ID phân đoạn bị trùng.');
  }
  if (segments.reduce((total, item) => total + item.text.length, 0) > MAX_TOTAL_CHARACTERS) {
    throw new Error('Transcript quá dài để chuẩn hóa trong một lượt.');
  }
  return segments;
}

export function validateOutputSegments(value: unknown, source: SpeechNormalizationSegment[]) {
  const output = value && typeof value === 'object' && 'segments' in value
    ? (value as { segments?: unknown }).segments
    : undefined;
  const normalized = validateInputSegments(output);
  if (normalized.length !== source.length) {
    throw new Error('Kết quả AI làm thiếu hoặc thừa phân đoạn. Nội dung gốc vẫn được giữ nguyên.');
  }
  for (let index = 0; index < source.length; index += 1) {
    if (normalized[index].id !== source[index].id) {
      throw new Error('Kết quả AI đổi ID hoặc thứ tự phân đoạn. Nội dung gốc vẫn được giữ nguyên.');
    }
  }
  return normalized;
}

function createCacheKey(model: string, inputJson: string) {
  return crypto
    .createHash('sha256')
    .update(`${TTS_NORMALIZATION_PROMPT_VERSION}\n${model}\n${inputJson}`)
    .digest('hex');
}

function readCachedResult(cacheKey: string, source: SpeechNormalizationSegment[]) {
  const row = getDb()
    .prepare('SELECT output_json FROM speech_normalization_cache WHERE cache_key = ?')
    .get(cacheKey) as { output_json: string } | undefined;
  if (!row) return null;
  try {
    return validateOutputSegments(JSON.parse(row.output_json), source);
  } catch {
    getDb().prepare('DELETE FROM speech_normalization_cache WHERE cache_key = ?').run(cacheKey);
    return null;
  }
}

function writeCachedResult(cacheKey: string, model: string, inputJson: string, segments: SpeechNormalizationSegment[]) {
  getDb().prepare(`
    INSERT INTO speech_normalization_cache (
      cache_key, prompt_version, model, input_json, output_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      output_json = excluded.output_json,
      created_at = excluded.created_at
  `).run(
    cacheKey,
    TTS_NORMALIZATION_PROMPT_VERSION,
    model,
    inputJson,
    JSON.stringify({ segments }),
    new Date().toISOString()
  );
}
