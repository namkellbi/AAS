import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  geminiTtsModel,
  getTtsModel,
  isTtsVoiceForProvider,
  openAiTtsModel
} from '@/lib/tts';
import type {
  TtsPreviewRequest,
  TtsPreviewResult,
  TtsProvider,
  TtsVoice,
  VieneuTtsVoice
} from '@/lib/types';
import {
  normalizeVietnameseForSpeech,
  vietnameseSlangTtsInstructions
} from '@/lib/vietnamese-speech';
import {
  checkDailyQuota,
  getGeminiApiKey,
  getOpenAiApiKey,
  logApiUsage
} from '@/server/db/client';
import { normalizeVietnameseSpeechBatch } from '@/server/video/speechNormalizationService';
import { synthesizeVieneuLocal } from '@/server/video/vieneuLocalService';
import { withRetry } from '@/server/utils/withRetry';

const speechProcessingVersion = 'multi-provider-vieneu-v2-lowercase';

type SpeechRequest = {
  apiKey?: string;
  provider: TtsProvider;
  input: string;
  instructions: string;
  outputPath: string;
  relatedPostId?: string;
  speed: number;
  voice: TtsVoice;
};

export async function synthesizeSpeech(request: SpeechRequest) {
  if (!isTtsVoiceForProvider(request.provider, request.voice)) {
    throw new Error(`Voice "${request.voice}" is not available for ${request.provider}.`);
  }

  const effectiveRequest: SpeechRequest = {
    ...request,
    // VieNeu is optimized for Vietnamese and may interpret capitalization as
    // an instruction to spell Latin text. Casing carries no pronunciation
    // value here, so normalize the complete transcript before synthesis.
    input: request.provider === 'vieneu'
      ? request.input.toLocaleLowerCase('vi-VN')
      : request.input,
    instructions: [
      request.instructions.trim(),
      speedInstruction(request.speed),
      vietnameseSlangTtsInstructions
    ].filter(Boolean).join(' ')
  };
  const model = getTtsModel(request.provider);
  const cacheDir = path.resolve(process.cwd(), 'data', 'tts-cache');
  const cacheKey = speechCacheKey(effectiveRequest);
  const cachePath = path.join(cacheDir, `${cacheKey}.mp3`);
  if (fs.existsSync(cachePath)) {
    fs.copyFileSync(cachePath, request.outputPath);
    return { cached: true, model, provider: request.provider };
  }

  const rawExtension = request.provider === 'vieneu' ? 'wav' : 'mp3';
  const rawPath = `${request.outputPath}.${crypto.randomUUID()}.raw.${rawExtension}`;
  const speedAdjustedPath = request.provider === 'vieneu'
    ? `${request.outputPath}.${crypto.randomUUID()}.speed.mp3`
    : rawPath;
  try {
    await withRetry(async () => {
      if (request.provider === 'gemini') {
        await synthesizeGeminiRaw(effectiveRequest, rawPath);
      } else if (request.provider === 'vieneu') {
        await synthesizeVieneuLocal({
          input: effectiveRequest.input,
          outputPath: rawPath,
          voice: effectiveRequest.voice as VieneuTtsVoice
        });
      } else {
        await synthesizeOpenAiRaw(effectiveRequest, rawPath);
      }
    });
    if (request.provider === 'vieneu') {
      await runProcess('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', rawPath,
        '-af', `atempo=${request.speed.toFixed(2)}`,
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        speedAdjustedPath
      ]);
    }
    await tightenUnexpectedPauses(
      speedAdjustedPath,
      request.outputPath,
      effectiveRequest.input,
      effectiveRequest.speed
    );
  } finally {
    fs.rmSync(rawPath, { force: true });
    if (speedAdjustedPath !== rawPath) fs.rmSync(speedAdjustedPath, { force: true });
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.copyFileSync(request.outputPath, cachePath);
  if (request.provider !== 'vieneu') {
    logApiUsage({
      kind: 'tts',
      model,
      inputUnits: effectiveRequest.input.length,
      relatedPostId: effectiveRequest.relatedPostId
    });
  }
  return { cached: false, model, provider: request.provider };
}

async function synthesizeOpenAiRaw(request: SpeechRequest, outputPath: string) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: openAiTtsModel,
      voice: request.voice,
      input: request.input,
      speed: request.speed,
      instructions: request.instructions
    })
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI TTS failed (${response.status}): ${(await response.text()).slice(0, 500)}`
    );
  }
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function synthesizeGeminiRaw(request: SpeechRequest, outputPath: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': request.apiKey ?? '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: geminiSpeechPrompt(request.input, request.instructions)
          }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: request.voice }
            }
          }
        }
      })
    }
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    const quotaHint = response.status === 429
      ? ' Free-tier quota may be exhausted; check Google AI Studio quota.'
      : '';
    throw new Error(`Gemini TTS failed (${response.status}): ${detail}${quotaHint}`);
  }

  const payload = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  };
  const part = payload.candidates?.[0]?.content?.parts?.find(
    (item) => item.inlineData?.data || item.inline_data?.data
  );
  const data = part?.inlineData?.data ?? part?.inline_data?.data;
  const mimeType = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? 'audio/L16;rate=24000';
  if (!data) throw new Error('Gemini TTS returned no audio data.');

  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000);
  const pcmPath = `${outputPath}.${crypto.randomUUID()}.pcm`;
  fs.writeFileSync(pcmPath, Buffer.from(data, 'base64'));
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 's16le',
      '-ar', String(sampleRate),
      '-ac', '1',
      '-i', pcmPath,
      '-af', `atempo=${request.speed.toFixed(2)}`,
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      outputPath
    ]);
  } finally {
    fs.rmSync(pcmPath, { force: true });
  }
}

function geminiSpeechPrompt(input: string, instructions: string) {
  return [
    'Read the transcript below exactly. Speak only the transcript; do not speak these directions.',
    'Use natural Vietnamese pronunciation. Do not add, remove, paraphrase, censor, or explain any words.',
    instructions ? `Director notes: ${instructions}` : '',
    'Transcript:',
    input
  ].filter(Boolean).join('\n');
}

function speedInstruction(speed: number) {
  if (speed >= 1.2) {
    return 'Ưu tiên nhịp đọc nhanh, gọn và có năng lượng. Tuyệt đối không ngắt giữa các từ khi văn bản không có dấu câu. Hạn chế kéo dài từ, nhưng vẫn phát âm rõ tiếng Việt.';
  }
  if (speed <= 0.95) {
    return 'Ưu tiên nhịp đọc chậm, rõ và có khoảng nghỉ tự nhiên.';
  }
  return '';
}

export async function createTtsPreview(request: TtsPreviewRequest): Promise<TtsPreviewResult> {
  const source = request.text.trim().slice(0, 500);
  const model = getTtsModel(request.provider);
  const responseSource = request.provider === 'gemini'
    ? 'gemini_api'
    : request.provider === 'vieneu'
      ? 'local_vieneu'
      : 'openai_api';
  if (!source) {
    return { ok: false, message: 'Preview text is empty.', model, source: responseSource };
  }
  if (!isTtsVoiceForProvider(request.provider, request.voice)) {
    return {
      ok: false,
      message: `Selected voice is not available for ${request.provider}.`,
      model,
      source: responseSource
    };
  }

  const providerApiKey = request.provider === 'gemini' ? getGeminiApiKey() : getOpenAiApiKey();
  if (request.provider !== 'vieneu' && !providerApiKey) {
    return {
      ok: false,
      message: `${request.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key is missing.`,
      model,
      source: responseSource
    };
  }

  const quota = checkDailyQuota();
  if (request.provider !== 'vieneu' && quota.exceeded) {
    return {
      ok: false,
      message: `Daily API cost limit reached ($${quota.todayUsd.toFixed(2)} / $${quota.limitUsd.toFixed(2)}).`,
      model,
      source: responseSource
    };
  }

  const openAiApiKey = getOpenAiApiKey();
  const [input] = openAiApiKey
    ? await normalizeVietnameseSpeechBatch([source], openAiApiKey)
    : [normalizeVietnameseForSpeech(source)];

  const previewDir = path.resolve(process.cwd(), 'data', 'tts-previews');
  fs.mkdirSync(previewDir, { recursive: true });
  const outputPath = path.join(previewDir, `${speechCacheKey({
    provider: request.provider,
    input,
    instructions: request.instructions,
    speed: request.speed,
    voice: request.voice
  })}.mp3`);
  const result = await synthesizeSpeech({
    apiKey: providerApiKey,
    provider: request.provider,
    input,
    instructions: request.instructions,
    outputPath,
    speed: request.speed,
    voice: request.voice
  });
  return {
    ok: true,
    message: result.cached
      ? 'Playing cached preview.'
      : request.provider === 'vieneu'
        ? 'Preview generated locally with VieNeu-TTS.'
        : `Preview generated with ${request.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API.`,
    audioDataUrl: `data:audio/mpeg;base64,${fs.readFileSync(outputPath).toString('base64')}`,
    cached: result.cached,
    model,
    source: responseSource
  };
}

export async function testGeminiConnection() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { ok: false, message: 'Gemini API key is missing.' };
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}`,
      { headers: { 'x-goog-api-key': apiKey } }
    );
    if (!response.ok) {
      return {
        ok: false,
        message: `Gemini connection failed (${response.status}): ${(await response.text()).slice(0, 300)}`
      };
    }
    return { ok: true, message: `Gemini connected. TTS model: ${geminiTtsModel}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function speechCacheKey(
  request: Pick<SpeechRequest, 'provider' | 'input' | 'instructions' | 'speed' | 'voice'>
) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      processing: speechProcessingVersion,
      provider: request.provider,
      model: getTtsModel(request.provider),
      input: request.input,
      voice: request.voice,
      speed: request.speed,
      instructions: request.instructions
    }))
    .digest('hex');
}

async function tightenUnexpectedPauses(
  inputPath: string,
  outputPath: string,
  text: string,
  speed: number
) {
  if (speed < 1.15) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  try {
    const duration = Number((await runProcess('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ])).stdout.trim());
    if (!Number.isFinite(duration)) throw new Error('Unable to inspect TTS duration.');

    const detection = await runProcess('ffmpeg', [
      '-hide_banner',
      '-i', inputPath,
      '-af', 'silencedetect=noise=-30dB:d=0.10',
      '-f', 'null',
      '-'
    ]);
    const silences = parseSilences(detection.stderr)
      .filter(
        (silence) =>
          silence.start > 0.08 &&
          silence.end < duration - 0.08 &&
          silence.end - silence.start >= 0.1
      );
    const punctuationPauses = (text.match(/[.!?;:,\n]+(?=\s*\S)/g) ?? []).length;
    const preserved = new Set(
      silences
        .map((silence, index) => ({ index, duration: silence.end - silence.start }))
        .sort((left, right) => right.duration - left.duration)
        .slice(0, punctuationPauses)
        .map(({ index }) => index)
    );
    const cuts = silences
      .filter((_silence, index) => !preserved.has(index))
      .map((silence) => ({
        start: silence.start + 0.035,
        end: silence.end - 0.035
      }))
      .filter((cut) => cut.end - cut.start >= 0.025);
    if (!cuts.length) {
      fs.copyFileSync(inputPath, outputPath);
      return;
    }

    const filters: string[] = [];
    const labels: string[] = [];
    let cursor = 0;
    cuts.forEach((cut, index) => {
      const label = `a${index}`;
      filters.push(
        `[0:a]atrim=start=${cursor.toFixed(4)}:end=${cut.start.toFixed(4)},asetpts=PTS-STARTPTS[${label}]`
      );
      labels.push(`[${label}]`);
      cursor = cut.end;
    });
    const finalLabel = `a${cuts.length}`;
    filters.push(`[0:a]atrim=start=${cursor.toFixed(4)},asetpts=PTS-STARTPTS[${finalLabel}]`);
    labels.push(`[${finalLabel}]`);
    filters.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`);

    await runProcess('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-filter_complex', filters.join(';'),
      '-map', '[out]',
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      outputPath
    ]);
  } catch {
    fs.copyFileSync(inputPath, outputPath);
  }
}

function parseSilences(stderr: string) {
  const silences: Array<{ start: number; end: number }> = [];
  let pendingStart: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([\d.]+)/);
    if (start) pendingStart = Number(start[1]);
    const end = line.match(/silence_end:\s*([\d.]+)/);
    if (end && pendingStart !== null) {
      silences.push({ start: pendingStart, end: Number(end[1]) });
      pendingStart = null;
    }
  }
  return silences.filter(
    (silence) =>
      Number.isFinite(silence.start) &&
      Number.isFinite(silence.end) &&
      silence.end > silence.start
  );
}

function runProcess(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`${command} failed (${code}). ${stderr.slice(-800)}`))
    );
  });
}
