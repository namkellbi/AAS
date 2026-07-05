import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { logApiUsage } from '@/server/db/client';
import { withRetry } from '@/server/utils/withRetry';

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptionResult = {
  words: WordTimestamp[];
  durationSecs: number;
};

const cacheDir = () => path.resolve(process.cwd(), 'data', 'transcript-cache');

export async function getWordTimestamps(audioPath: string, apiKey: string, relatedPostId?: string): Promise<TranscriptionResult> {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
  const cachePath = path.join(cacheDir(), `${hash}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as TranscriptionResult;
      if (Array.isArray(cached.words)) return cached;
    } catch {
      // cache hỏng thì transcribe lại
    }
  }

  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: 'vi'
    })
  );

  const raw = response as unknown as { words?: Array<{ word?: string; start?: number; end?: number }>; duration?: number };
  const words = (raw.words ?? [])
    .map((item) => ({ word: String(item.word ?? '').trim(), start: Number(item.start ?? 0), end: Number(item.end ?? 0) }))
    .filter((item) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start);
  const durationSecs = Number.isFinite(Number(raw.duration)) && Number(raw.duration) > 0 ? Number(raw.duration) : words.length ? words[words.length - 1].end : 0;
  const result: TranscriptionResult = { words, durationSecs };

  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result), 'utf8');
  if (result.durationSecs > 0) {
    logApiUsage({ kind: 'transcription', model: 'whisper-1', inputUnits: Math.round(result.durationSecs), relatedPostId });
  }
  return result;
}
