import { spawn } from 'node:child_process';
import type { WordTimestamp } from '@/server/video/transcriptionService';

const MAX_WORDS_PER_CHUNK = 4;
const MAX_CHARS_PER_CHUNK = 18;
const GAP_BREAK_SECS = 0.6;
const CHUNK_TAIL_SECS = 0.12;

const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Arial,84,&H0000E7FF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,6,0,2,60,60,640,163

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

export function buildKaraokeAss(words: WordTimestamp[]): string {
  const chunks = groupWords(words);
  const events = chunks.map((chunk, index) => {
    const start = chunk[0].start;
    const nextStart = chunks[index + 1]?.[0]?.start;
    const rawEnd = chunk[chunk.length - 1].end + CHUNK_TAIL_SECS;
    const end = Math.max(start + 0.05, nextStart !== undefined ? Math.min(rawEnd, nextStart) : rawEnd);
    const text = chunk
      .map((word) => `{\\k${Math.max(1, Math.round((word.end - word.start) * 100))}}${escapeAssText(word.word)}`)
      .join(' ');
    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Karaoke,,0,0,0,,${text}`;
  });
  return `${assHeader}\n${events.join('\n')}\n`;
}

function groupWords(words: WordTimestamp[]): WordTimestamp[][] {
  const chunks: WordTimestamp[][] = [];
  let current: WordTimestamp[] = [];
  let currentChars = 0;

  for (const word of words) {
    const gap = current.length ? word.start - current[current.length - 1].end : 0;
    const wouldOverflow = current.length >= MAX_WORDS_PER_CHUNK || (current.length >= 2 && currentChars + word.word.length + 1 > MAX_CHARS_PER_CHUNK);
    if (current.length && (wouldOverflow || gap > GAP_BREAK_SECS)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(word);
    currentChars += word.word.length + (current.length > 1 ? 1 : 0);
    if (current.length >= 2 && /[.!?…]$/.test(word.word)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function toAssTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.round((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(Math.min(centis, 99)).padStart(2, '0')}`;
}

function escapeAssText(value: string): string {
  return value.replace(/[{}]/g, '').replace(/\\/g, '').replace(/\r?\n/g, ' ');
}

export function subtitlesFilterArg(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
  return `subtitles=filename='${normalized}'`;
}

let subtitlesFilterAvailable: boolean | null = null;

export async function ensureSubtitlesFilterAvailable(): Promise<void> {
  if (subtitlesFilterAvailable === null) {
    try {
      const output = await runProcess('ffmpeg', ['-hide_banner', '-filters']);
      subtitlesFilterAvailable = /\bsubtitles\b/.test(output);
    } catch (error) {
      subtitlesFilterAvailable = null;
      throw error;
    }
  }
  if (!subtitlesFilterAvailable) {
    throw new Error('FFmpeg hiện tại thiếu libass (filter "subtitles") nên không burn được karaoke caption. Cài bản FFmpeg full (ví dụ bản "full" từ gyan.dev) và thêm vào PATH, hoặc tắt Karaoke caption trong Settings.');
  }
}

function runProcess(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => reject(new Error(`${command} could not start. Install FFmpeg and add it to PATH. ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${command} failed (${code}). ${stderr.slice(-1200)}`))));
  });
}
