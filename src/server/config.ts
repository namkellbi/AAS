import fs from 'node:fs';
import path from 'node:path';
import { recommendedOpenAIModel } from '@/lib/openai-models';

export type AppConfig = {
  databasePath: string;
  openAiApiKey?: string;
  openAiModel: string;
  threadsStorageState: string;
  threadsProfileDir: string;
  scraperMaxPosts: number;
  scraperMinDelayMs: number;
};

let loaded = false;

function loadDotEnv() {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getConfig(): AppConfig {
  loadDotEnv();

  return {
    databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/app.sqlite'),
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL ?? recommendedOpenAIModel,
    threadsStorageState: path.resolve(process.cwd(), process.env.THREADS_STORAGE_STATE ?? './data/threads-session.json'),
    threadsProfileDir: path.resolve(process.cwd(), process.env.THREADS_PROFILE_DIR ?? './data/threads-browser-profile'),
    scraperMaxPosts: Number(process.env.SCRAPER_MAX_POSTS ?? 40),
    scraperMinDelayMs: Number(process.env.SCRAPER_MIN_DELAY_MS ?? 1500)
  };
}
