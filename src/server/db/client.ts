import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/server/config';
import { schema } from '@/server/db/schema';
import { defaultKeywords } from '@/lib/mock-data';
import { recommendedOpenAIModel } from '@/lib/openai-models';
import { detectThreadsAccountName } from '@/server/scraper/threadsScraper';
import type { AIAnalysis, Keyword, SavedPost, ThreadsPost } from '@/lib/types';
import { nowIso } from '@/lib/utils';

let db: Database.Database | null = null;

function jsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getDb() {
  if (db) return db;

  const config = getConfig();
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  seedKeywords();
  return db;
}

export function seedKeywords() {
  const database = db ?? getDb();
  const statement = database.prepare(`
    INSERT OR IGNORE INTO keywords (id, phrase, enabled, cadence_minutes, last_fetched_at)
    VALUES (@id, @phrase, @enabled, @cadenceMinutes, @lastFetchedAt)
  `);

  for (const keyword of defaultKeywords) {
    statement.run({
      id: keyword.id,
      phrase: keyword.phrase,
      enabled: keyword.enabled ? 1 : 0,
      cadenceMinutes: keyword.cadenceMinutes,
      lastFetchedAt: keyword.lastFetchedAt ?? null
    });
  }
}

export function upsertPosts(posts: ThreadsPost[]) {
  const database = getDb();
  const statement = database.prepare(`
    INSERT INTO threads_posts (
      id, author, author_handle, content, likes, replies, reposts, timestamp, image_urls,
      url, source, keyword, fetched_at, trending_score, emotional_category
    ) VALUES (
      @id, @author, @authorHandle, @content, @likes, @replies, @reposts, @timestamp, @imageUrls,
      @url, @source, @keyword, @fetchedAt, @trendingScore, @emotionalCategory
    )
    ON CONFLICT(id) DO UPDATE SET
      author = excluded.author,
      author_handle = excluded.author_handle,
      content = excluded.content,
      likes = excluded.likes,
      replies = excluded.replies,
      reposts = excluded.reposts,
      timestamp = excluded.timestamp,
      image_urls = excluded.image_urls,
      url = excluded.url,
      source = excluded.source,
      keyword = excluded.keyword,
      fetched_at = excluded.fetched_at,
      trending_score = excluded.trending_score,
      emotional_category = excluded.emotional_category
  `);

  const transaction = database.transaction((items: ThreadsPost[]) => {
    for (const post of items) {
      statement.run({ ...post, imageUrls: JSON.stringify(post.imageUrls), authorHandle: post.authorHandle ?? null, keyword: post.keyword ?? null });
    }
  });
  transaction(posts);
}

export function removeLegacyPostsForKeyword(keyword: string) {
  getDb().prepare("DELETE FROM threads_posts WHERE keyword = ? AND url NOT LIKE '%/post/%'").run(keyword);
}

export function listPosts(limit = 200): ThreadsPost[] {
  const rows = getDb()
    .prepare('SELECT * FROM threads_posts ORDER BY trending_score DESC, fetched_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];

  return rows.map(rowToPost);
}

export function storeAnalysis(analysis: AIAnalysis) {
  getDb()
    .prepare(`
      INSERT INTO ai_analysis (
        post_id, emotion, pain_point, buying_intent, affiliate_categories, affiliate_products,
        content_angle, why_viral, hooks, ctas, relatability_score, controversy_score, created_at
      ) VALUES (
        @postId, @emotion, @painPoint, @buyingIntent, @affiliateCategories, @affiliateProducts,
        @contentAngle, @whyViral, @hooks, @ctas, @relatabilityScore, @controversyScore, @createdAt
      )
      ON CONFLICT(post_id) DO UPDATE SET
        emotion = excluded.emotion,
        pain_point = excluded.pain_point,
        buying_intent = excluded.buying_intent,
        affiliate_categories = excluded.affiliate_categories,
        affiliate_products = excluded.affiliate_products,
        content_angle = excluded.content_angle,
        why_viral = excluded.why_viral,
        hooks = excluded.hooks,
        ctas = excluded.ctas,
        relatability_score = excluded.relatability_score,
        controversy_score = excluded.controversy_score,
        created_at = excluded.created_at
    `)
    .run({
      ...analysis,
      affiliateCategories: JSON.stringify(analysis.affiliateCategories),
      affiliateProducts: JSON.stringify(analysis.affiliateProducts),
      hooks: JSON.stringify(analysis.hooks),
      ctas: JSON.stringify(analysis.ctas)
    });
}

export function getAnalysis(postId: string): AIAnalysis | null {
  const row = getDb().prepare('SELECT * FROM ai_analysis WHERE post_id = ?').get(postId) as Record<string, unknown> | undefined;
  return row ? rowToAnalysis(row) : null;
}

export function savePost(postId: string, collection: string, tags: string[]) {
  getDb()
    .prepare('INSERT OR REPLACE INTO saved_posts (post_id, collection, tags, saved_at) VALUES (?, ?, ?, ?)')
    .run(postId, collection, JSON.stringify(tags), nowIso());
}

export function listSavedPosts(): SavedPost[] {
  const rows = getDb().prepare('SELECT * FROM saved_posts ORDER BY saved_at DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    postId: String(row.post_id),
    collection: String(row.collection),
    tags: jsonParse<string[]>(String(row.tags), []),
    savedAt: String(row.saved_at)
  }));
}

export function addKeyword(phrase: string): Keyword {
  const keyword: Keyword = {
    id: crypto.randomUUID(),
    phrase: phrase.trim(),
    enabled: true,
    cadenceMinutes: 120
  };

  getDb()
    .prepare('INSERT INTO keywords (id, phrase, enabled, cadence_minutes, last_fetched_at) VALUES (?, ?, ?, ?, ?)')
    .run(keyword.id, keyword.phrase, 1, keyword.cadenceMinutes, null);

  return keyword;
}

export function listKeywords(): Keyword[] {
  const rows = getDb().prepare('SELECT * FROM keywords ORDER BY phrase ASC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    phrase: String(row.phrase),
    enabled: Boolean(row.enabled),
    cadenceMinutes: Number(row.cadence_minutes),
    lastFetchedAt: row.last_fetched_at ? String(row.last_fetched_at) : undefined
  }));
}

export function setKeywordEnabled(id: string, enabled: boolean) {
  getDb().prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

export function createFetchLog(mode: string, query?: string) {
  const id = crypto.randomUUID();
  getDb()
    .prepare('INSERT INTO fetch_logs (id, mode, query, status, started_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, mode, query ?? null, 'running', nowIso());
  return id;
}

export function finishFetchLog(id: string, status: 'success' | 'error', postCount: number, message?: string) {
  getDb()
    .prepare('UPDATE fetch_logs SET status = ?, post_count = ?, message = ?, finished_at = ? WHERE id = ?')
    .run(status, postCount, message ?? null, nowIso(), id);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, nowIso());
}

export function setOpenAiApiKey(apiKey: string) {
  setSetting('openai.api_key', encryptSecret(apiKey));
}

export function getOpenAiApiKey() {
  const stored = getSetting('openai.api_key');
  return stored ? decryptSecret(stored) : process.env.OPENAI_API_KEY || '';
}

export function getOpenAiModel() {
  return getSetting('openai.model') || process.env.OPENAI_MODEL || recommendedOpenAIModel;
}

export function getAllowDemoMode() {
  return getSetting('app.allow_demo_mode') === 'true';
}

export function getLanguage() {
  const language = getSetting('app.language');
  return language === 'vi' || language === 'en' ? language : 'en';
}

export function setAllowDemoMode(value: boolean) {
  setSetting('app.allow_demo_mode', String(value));
}

export function getAppSettings() {
  const config = getConfig();
  const apiKey = getOpenAiApiKey();
  const accountName = detectThreadsAccountName();
  return {
    openAiApiKeySet: Boolean(apiKey),
    maskedOpenAiApiKey: apiKey ? maskOpenAiApiKey(apiKey) : undefined,
    openAiModel: getOpenAiModel(),
    threadsSessionExists: fs.existsSync(config.threadsStorageState) || fs.existsSync(config.threadsProfileDir),
    threadsAccountName: accountName === 'Your Chromium' ? undefined : accountName,
    language: getLanguage(),
    allowDemoMode: getAllowDemoMode()
  };
}

function maskOpenAiApiKey(apiKey: string) {
  if (apiKey.length <= 10) return 'sk-••••••••';
  const prefix = apiKey.slice(0, Math.min(7, apiKey.length));
  const suffix = apiKey.slice(-4);
  return `${prefix}${'•'.repeat(10)}${suffix}`;
}

function encryptSecret(value: string) {
  const safeStorage = getSafeStorage();
  if (!safeStorage?.isEncryptionAvailable()) return value;
  return `enc:v1:${safeStorage.encryptString(value).toString('base64')}`;
}

function decryptSecret(value: string) {
  if (!value.startsWith('enc:v1:')) return value;

  const safeStorage = getSafeStorage();
  if (!safeStorage?.isEncryptionAvailable()) return '';

  try {
    return safeStorage.decryptString(Buffer.from(value.slice('enc:v1:'.length), 'base64'));
  } catch {
    return '';
  }
}

function getSafeStorage(): { isEncryptionAvailable: () => boolean; encryptString: (value: string) => Buffer; decryptString: (value: Buffer) => string } | null {
  try {
    const electron = require('electron') as {
      safeStorage?: { isEncryptionAvailable: () => boolean; encryptString: (value: string) => Buffer; decryptString: (value: Buffer) => string };
    };
    return electron.safeStorage ?? null;
  } catch {
    return null;
  }
}

function rowToPost(row: Record<string, unknown>): ThreadsPost {
  return {
    id: String(row.id),
    author: String(row.author),
    authorHandle: row.author_handle ? String(row.author_handle) : undefined,
    content: String(row.content),
    likes: Number(row.likes),
    replies: Number(row.replies),
    reposts: Number(row.reposts),
    timestamp: String(row.timestamp),
    imageUrls: jsonParse<string[]>(String(row.image_urls), []),
    url: String(row.url),
    source: row.source as ThreadsPost['source'],
    keyword: row.keyword ? String(row.keyword) : undefined,
    fetchedAt: String(row.fetched_at),
    trendingScore: Number(row.trending_score),
    emotionalCategory: String(row.emotional_category)
  };
}

function rowToAnalysis(row: Record<string, unknown>): AIAnalysis {
  return {
    postId: String(row.post_id),
    emotion: String(row.emotion),
    painPoint: String(row.pain_point),
    buyingIntent: row.buying_intent as AIAnalysis['buyingIntent'],
    affiliateCategories: jsonParse<string[]>(String(row.affiliate_categories), []),
    affiliateProducts: jsonParse<string[]>(String(row.affiliate_products), []),
    contentAngle: String(row.content_angle),
    whyViral: String(row.why_viral),
    hooks: jsonParse<string[]>(String(row.hooks), []),
    ctas: jsonParse<string[]>(String(row.ctas), []),
    relatabilityScore: Number(row.relatability_score),
    controversyScore: Number(row.controversy_score),
    createdAt: String(row.created_at)
  };
}
