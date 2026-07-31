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

const forcedTranscriptVersion = 'forced-script-v3-preserve-word-starts';
const cacheDir = () => path.resolve(process.cwd(), 'data', 'transcript-cache');

export async function getWordTimestamps(
  audioPath: string,
  apiKey: string,
  relatedPostId?: string,
  expectedTranscript?: string
): Promise<TranscriptionResult> {
  const audioHash = crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
  const expected = expectedTranscript?.normalize('NFC').trim() ?? '';
  const cacheHash = expected
    ? crypto
        .createHash('sha256')
        .update(JSON.stringify({ audioHash, expected, version: forcedTranscriptVersion }))
        .digest('hex')
    : audioHash;
  const cachePath = path.join(cacheDir(), `${cacheHash}.json`);
  const cached = readTranscriptCache(cachePath);
  if (cached) return cached;

  const whisperCachePath = path.join(cacheDir(), `${audioHash}.whisper-words.json`);
  const whisperCached = readTranscriptCache(whisperCachePath);
  if (whisperCached) {
    const result = expected
      ? forceExpectedTranscript(whisperCached, expected)
      : whisperCached;
    writeTranscriptCache(cachePath, result);
    return result;
  }

  // Upgrade old Whisper-only caches locally so existing videos do not need another API call.
  const legacyCachePath = path.join(cacheDir(), `${audioHash}.json`);
  const legacy = expected && legacyCachePath !== cachePath ? readTranscriptCache(legacyCachePath) : null;
  if (legacy) {
    const upgraded = forceExpectedTranscript(legacy, expected);
    writeTranscriptCache(cachePath, upgraded);
    return upgraded;
  }

  const client = new OpenAI({ apiKey });
  const response = await withRetry(() =>
    client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: 'vi',
      ...(expected ? { prompt: expected.slice(0, 1000) } : {})
    })
  );

  const raw = response as unknown as {
    words?: Array<{ word?: string; start?: number; end?: number }>;
    duration?: number;
  };
  const words = (raw.words ?? [])
    .map((item) => ({
      word: String(item.word ?? '').trim(),
      start: Number(item.start ?? 0),
      end: Number(item.end ?? 0)
    }))
    .filter(
      (item) =>
        item.word &&
        Number.isFinite(item.start) &&
        Number.isFinite(item.end) &&
        item.end >= item.start
    );
  const durationSecs =
    Number.isFinite(Number(raw.duration)) && Number(raw.duration) > 0
      ? Number(raw.duration)
      : words.length
        ? words[words.length - 1].end
        : 0;
  const transcribed: TranscriptionResult = { words, durationSecs };
  writeTranscriptCache(whisperCachePath, transcribed);
  const result = expected ? forceExpectedTranscript(transcribed, expected) : transcribed;

  writeTranscriptCache(cachePath, result);
  if (result.durationSecs > 0) {
    logApiUsage({
      kind: 'transcription',
      model: 'whisper-1',
      inputUnits: Math.round(result.durationSecs),
      relatedPostId
    });
  }
  return result;
}

export function forceExpectedTranscript(
  transcription: TranscriptionResult,
  expectedTranscript: string
): TranscriptionResult {
  const expectedWords = tokenizeExpectedTranscript(expectedTranscript);
  if (!expectedWords.length) return transcription;

  const sourceWords = transcription.words.filter(
    (item) =>
      Number.isFinite(item.start) &&
      Number.isFinite(item.end) &&
      item.end >= item.start
  );

  const sourceEnd = sourceWords[sourceWords.length - 1]?.end ?? 0;
  const timedEnd = sourceWords.length ? sourceEnd : transcription.durationSecs;
  const start = sourceWords[0]?.start ?? 0;
  const end = Math.max(start + 0.04 * expectedWords.length, timedEnd);
  if (!sourceWords.length) {
    return {
      ...transcription,
      words: distributeWords(expectedWords, start, end)
    };
  }

  const mapping = alignExpectedWords(expectedWords, sourceWords);
  const alignedWords: Array<WordTimestamp | null> = mapping.map((sourceIndex, expectedIndex) =>
    sourceIndex === null
      ? null
      : {
          word: expectedWords[expectedIndex],
          start: sourceWords[sourceIndex].start,
          end: sourceWords[sourceIndex].end
        }
  );
  fillUntimedRuns(alignedWords, expectedWords, start, end);

  let previousStart = Math.max(0, start - 0.01);
  const words = alignedWords.map((word, index) => {
    const resolved = word ?? {
      word: expectedWords[index],
      start: previousStart + 0.01,
      end: previousStart + 0.05
    };
    // Whisper word intervals can overlap slightly. Chaining every word to the
    // previous word's end turns those harmless overlaps into cumulative drift,
    // making long karaoke lines increasingly late. Only require starts to be
    // monotonic; buildKaraokeAss uses the next start as the highlight boundary.
    const wordStart = Math.max(previousStart + 0.01, resolved.start);
    const wordEnd = Math.max(wordStart + 0.01, resolved.end);
    previousStart = wordStart;
    return { word: expectedWords[index], start: wordStart, end: wordEnd };
  });

  return {
    ...transcription,
    words,
    durationSecs: Math.max(transcription.durationSecs, words[words.length - 1]?.end ?? 0)
  };
}

function alignExpectedWords(
  expectedWords: string[],
  sourceWords: WordTimestamp[]
): Array<number | null> {
  const expected = expectedWords.map(normalizeAlignmentWord);
  const source = sourceWords.map((item) => normalizeAlignmentWord(item.word));
  const rows = expected.length + 1;
  const columns = source.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  const moves = Array.from(
    { length: rows },
    () => Array<'match' | 'expected' | 'source'>(columns).fill('match')
  );

  for (let row = 1; row < rows; row += 1) {
    costs[row][0] = row * 0.85;
    moves[row][0] = 'expected';
  }
  for (let column = 1; column < columns; column += 1) {
    costs[0][column] = costs[0][column - 1] + (source[column - 1] ? 0.75 : 0.1);
    moves[0][column] = 'source';
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const similarityCost = alignmentWordCost(expected[row - 1], source[column - 1]);
      const candidates = [
        { move: 'match' as const, cost: costs[row - 1][column - 1] + similarityCost },
        { move: 'expected' as const, cost: costs[row - 1][column] + 0.85 },
        {
          move: 'source' as const,
          cost: costs[row][column - 1] + (source[column - 1] ? 0.75 : 0.1)
        }
      ].sort((left, right) => left.cost - right.cost);
      costs[row][column] = candidates[0].cost;
      moves[row][column] = candidates[0].move;
    }
  }

  const mapping: Array<number | null> = Array(expectedWords.length).fill(null);
  let row = expected.length;
  let column = source.length;
  while (row > 0 || column > 0) {
    const move = moves[row][column];
    if (row > 0 && column > 0 && move === 'match') {
      if (alignmentWordCost(expected[row - 1], source[column - 1]) <= 0.75) {
        mapping[row - 1] = column - 1;
      }
      row -= 1;
      column -= 1;
    } else if (row > 0 && (column === 0 || move === 'expected')) {
      row -= 1;
    } else {
      column -= 1;
    }
  }
  return mapping;
}

function fillUntimedRuns(
  words: Array<WordTimestamp | null>,
  expectedWords: string[],
  transcriptStart: number,
  transcriptEnd: number
) {
  let index = 0;
  while (index < words.length) {
    if (words[index]) {
      index += 1;
      continue;
    }
    const runStart = index;
    while (index < words.length && !words[index]) index += 1;
    const runEnd = index;
    const nextStart = words[runEnd]?.start ?? transcriptEnd;
    const previousWord = words[runStart - 1];
    // Leave the following matched word anchored to Whisper even when its
    // interval overlaps the preceding word.
    const intervalEnd = Math.max(transcriptStart, nextStart);
    const intervalStart = Math.min(
      previousWord?.end ?? transcriptStart,
      Math.max(previousWord?.start ?? transcriptStart, intervalEnd - 0.01 * (runEnd - runStart))
    );
    const distributed = distributeWords(
      expectedWords.slice(runStart, runEnd),
      intervalStart,
      intervalEnd
    );
    distributed.forEach((word, offset) => {
      words[runStart + offset] = word;
    });
  }
}

function distributeWords(words: string[], start: number, end: number): WordTimestamp[] {
  const weights = words.map((word) =>
    Math.max(1, Array.from(word.replace(/[^\p{L}\p{N}]/gu, '')).length)
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = start;

  return words.map((word, index) => {
    const wordStart = cursor;
    const wordEnd =
      index === words.length - 1
        ? end
        : Math.min(end, wordStart + ((end - start) * weights[index]) / totalWeight);
    cursor = wordEnd;
    return { word, start: wordStart, end: wordEnd };
  });
}

function alignmentWordCost(left: string, right: string) {
  if (!left || !right) return 2;
  if (left === right) return 0;
  const leftPlain = stripVietnameseMarks(left);
  const rightPlain = stripVietnameseMarks(right);
  if (leftPlain === rightPlain) return 0.08;
  const distance = levenshteinDistance(leftPlain, rightPlain);
  const ratio = distance / Math.max(leftPlain.length, rightPlain.length, 1);
  if (ratio <= 0.25) return 0.35;
  if (ratio <= 0.45) return 0.7;
  return 2;
}

function normalizeAlignmentWord(value: string) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function stripVietnameseMarks(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_item, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function tokenizeExpectedTranscript(value: string): string[] {
  return value
    .normalize('NFC')
    .replace(/[:;=8xX][\-^']*[\)\(DdpP]+/g, ' ')
    .replace(/[\)\(]{3,}/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^["'“”‘’()[\]{}]+|["'“”‘’()[\]{}]+$/g, '').trim())
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
}

function readTranscriptCache(cachePath: string): TranscriptionResult | null {
  if (!fs.existsSync(cachePath)) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as TranscriptionResult;
    if (Array.isArray(cached.words)) return cached;
  } catch {
    // Ignore invalid cache and transcribe again.
  }
  return null;
}

function writeTranscriptCache(cachePath: string, result: TranscriptionResult): void {
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result), 'utf8');
}
