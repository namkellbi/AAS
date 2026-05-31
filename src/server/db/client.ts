import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/server/config';
import { schema } from '@/server/db/schema';
import { defaultKeywords } from '@/lib/mock-data';
import { recommendedOpenAIModel } from '@/lib/openai-models';
import { detectThreadsAccountName } from '@/server/scraper/threadsScraper';
import { scorePost } from '@/server/scoring/trendingScore';
import type { AIAnalysis, Keyword, SavedPost, ThreadsPost } from '@/lib/types';
import { clamp, nowIso } from '@/lib/utils';

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
  migrateSchema(db);
  rescoreStoredPosts(db);
  seedKeywords();
  return db;
}

function rescoreStoredPosts(database: Database.Database) {
  const rows = database.prepare('SELECT * FROM threads_posts').all() as Record<string, unknown>[];
  const update = database.prepare(`
    UPDATE threads_posts
    SET trending_score = ?, affiliate_fit_score = ?, opportunity_score = ?, emotional_category = ?
    WHERE id = ?
  `);
  const transaction = database.transaction(() => {
    for (const row of rows) {
      const post = rowToPost(row);
      const score = scorePost(post);
      update.run(score.score, score.affiliateFitScore, score.opportunityScore, score.emotionalCategory, post.id);
    }
  });
  transaction();
}

function migrateSchema(database: Database.Database) {
  ensureColumn(database, 'threads_posts', 'affiliate_fit_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'opportunity_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'velocity_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'engagement_growth_percent', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'ai_analysis', 'verdict', "TEXT NOT NULL DEFAULT 'watch'");
  ensureColumn(database, 'ai_analysis', 'confidence_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'ai_analysis', 'affiliate_fit_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'ai_analysis', 'personas', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'situations', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'demo_angle', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'ai_analysis', 'content_format', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'ai_analysis', 'solution_script', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'ai_analysis', 'product_search_keywords', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'script_outline', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'reject_reason', 'TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS idx_threads_posts_opportunity ON threads_posts(opportunity_score DESC)');
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function seedKeywords() {
  const database = db ?? getDb();
  const seeded = database.prepare("SELECT value FROM app_settings WHERE key = 'app.default_keywords_seeded'").get() as { value: string } | undefined;
  if (seeded?.value === 'true') return;
  const existing = database.prepare('SELECT COUNT(*) AS count FROM keywords').get() as { count: number };
  if (existing.count > 0) {
    markDefaultKeywordsSeeded(database);
    return;
  }

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

  markDefaultKeywordsSeeded(database);
}

function markDefaultKeywordsSeeded(database: Database.Database) {
  database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('app.default_keywords_seeded', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(nowIso());
}

export function upsertPosts(posts: ThreadsPost[]) {
  const database = getDb();
  const statement = database.prepare(`
    INSERT INTO threads_posts (
      id, author, author_handle, content, likes, replies, reposts, timestamp, image_urls,
      url, source, keyword, fetched_at, trending_score, affiliate_fit_score, opportunity_score, velocity_score, engagement_growth_percent, emotional_category
    ) VALUES (
      @id, @author, @authorHandle, @content, @likes, @replies, @reposts, @timestamp, @imageUrls,
      @url, @source, @keyword, @fetchedAt, @trendingScore, @affiliateFitScore, @opportunityScore, @velocityScore, @engagementGrowthPercent, @emotionalCategory
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
      affiliate_fit_score = excluded.affiliate_fit_score,
      opportunity_score = excluded.opportunity_score,
      velocity_score = excluded.velocity_score,
      engagement_growth_percent = excluded.engagement_growth_percent,
      emotional_category = excluded.emotional_category
  `);

  const transaction = database.transaction((items: ThreadsPost[]) => {
    for (const post of items) {
      statement.run({ ...post, imageUrls: JSON.stringify(post.imageUrls), authorHandle: post.authorHandle ?? null, keyword: post.keyword ?? null });
    }
  });
  transaction(posts);
}

export function enrichPostsWithVelocity(posts: ThreadsPost[]) {
  const database = getDb();
  const latest = database.prepare(`
    SELECT likes, replies, reposts, captured_at
    FROM engagement_snapshots
    WHERE post_id = ?
    ORDER BY captured_at DESC
    LIMIT 1
  `);

  return posts.map((post) => {
    const previous = latest.get(post.id) as { likes: number; replies: number; reposts: number; captured_at: string } | undefined;
    if (!previous) return post;

    const elapsedHours = Math.max((Date.now() - new Date(previous.captured_at).getTime()) / 36e5, 1 / 60);
    const currentEngagement = weightedEngagement(post);
    const previousEngagement = previous.likes + previous.replies * 3 + previous.reposts * 4;
    const delta = Math.max(currentEngagement - previousEngagement, 0);
    const velocityScore = Math.round(clamp(Math.log10(delta / elapsedHours + 1) * 12, 0, 30));
    const engagementGrowthPercent = previousEngagement > 0 ? Math.round(clamp((delta / previousEngagement) * 100, 0, 999)) : 0;

    return {
      ...post,
      velocityScore,
      engagementGrowthPercent,
      opportunityScore: Math.round(clamp(post.opportunityScore + velocityScore * 0.45, 0, 100))
    };
  });
}

export function recordEngagementSnapshots(posts: ThreadsPost[]) {
  const statement = getDb().prepare(`
    INSERT INTO engagement_snapshots (id, post_id, likes, replies, reposts, captured_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const transaction = getDb().transaction((items: ThreadsPost[]) => {
    for (const post of items) statement.run(crypto.randomUUID(), post.id, post.likes, post.replies, post.reposts, nowIso());
  });
  transaction(posts);
}

function weightedEngagement(post: Pick<ThreadsPost, 'likes' | 'replies' | 'reposts'>) {
  return post.likes + post.replies * 3 + post.reposts * 4;
}

export function removeLegacyPostsForKeyword(keyword: string) {
  getDb().prepare("DELETE FROM threads_posts WHERE keyword = ? AND url NOT LIKE '%/post/%'").run(keyword);
}

export function listPosts(limit = 200): ThreadsPost[] {
  const rows = getDb()
    .prepare('SELECT * FROM threads_posts ORDER BY opportunity_score DESC, trending_score DESC, fetched_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];

  return rows.map(rowToPost);
}

export function storeAnalysis(analysis: AIAnalysis) {
  getDb()
    .prepare(`
      INSERT INTO ai_analysis (
        post_id, verdict, confidence_score, emotion, pain_point, buying_intent, affiliate_categories, affiliate_products,
        content_angle, why_viral, hooks, ctas, relatability_score, controversy_score, created_at
        , affiliate_fit_score, personas, situations, demo_angle, content_format, solution_script, product_search_keywords, script_outline, reject_reason
      ) VALUES (
        @postId, @verdict, @confidenceScore, @emotion, @painPoint, @buyingIntent, @affiliateCategories, @affiliateProducts,
        @contentAngle, @whyViral, @hooks, @ctas, @relatabilityScore, @controversyScore, @createdAt
        , @affiliateFitScore, @personas, @situations, @demoAngle, @contentFormat, @solutionScript, @productSearchKeywords, @scriptOutline, @rejectReason
      )
      ON CONFLICT(post_id) DO UPDATE SET
        verdict = excluded.verdict,
        confidence_score = excluded.confidence_score,
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
        affiliate_fit_score = excluded.affiliate_fit_score,
        personas = excluded.personas,
        situations = excluded.situations,
        demo_angle = excluded.demo_angle,
        content_format = excluded.content_format,
        solution_script = excluded.solution_script,
        product_search_keywords = excluded.product_search_keywords,
        script_outline = excluded.script_outline,
        reject_reason = excluded.reject_reason,
        created_at = excluded.created_at
    `)
    .run({
      ...analysis,
      affiliateCategories: JSON.stringify(analysis.affiliateCategories),
      affiliateProducts: JSON.stringify(analysis.affiliateProducts),
      hooks: JSON.stringify(analysis.hooks),
      ctas: JSON.stringify(analysis.ctas),
      personas: JSON.stringify(analysis.personas),
      situations: JSON.stringify(analysis.situations),
      productSearchKeywords: JSON.stringify(analysis.productSearchKeywords),
      scriptOutline: JSON.stringify(analysis.scriptOutline),
      rejectReason: analysis.rejectReason ?? null
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

export function unsavePost(postId: string, collection: string) {
  getDb().prepare('DELETE FROM saved_posts WHERE post_id = ? AND collection = ?').run(postId, collection);
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
  const normalized = phrase.trim();
  if (!normalized) throw new Error('Keyword cannot be empty.');
  const duplicate = getDb().prepare('SELECT * FROM keywords WHERE lower(phrase) = lower(?)').get(normalized) as Record<string, unknown> | undefined;
  if (duplicate) throw new Error(`Keyword "${normalized}" already exists.`);

  const keyword: Keyword = {
    id: crypto.randomUUID(),
    phrase: normalized,
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
  return rows.map(rowToKeyword);
}

export function setKeywordEnabled(id: string, enabled: boolean) {
  getDb().prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

export function updateKeyword(id: string, phrase: string): Keyword {
  const normalized = phrase.trim();
  if (!normalized) throw new Error('Keyword cannot be empty.');
  const duplicate = getDb().prepare('SELECT id FROM keywords WHERE lower(phrase) = lower(?) AND id <> ?').get(normalized, id) as { id: string } | undefined;
  if (duplicate) throw new Error(`Keyword "${normalized}" already exists.`);
  const result = getDb().prepare('UPDATE keywords SET phrase = ? WHERE id = ?').run(normalized, id);
  if (!result.changes) throw new Error('Keyword was not found.');
  const row = getDb().prepare('SELECT * FROM keywords WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToKeyword(row);
}

export function deleteKeyword(id: string) {
  getDb().prepare('DELETE FROM keywords WHERE id = ?').run(id);
}

export function markKeywordFetched(id: string) {
  getDb().prepare('UPDATE keywords SET last_fetched_at = ? WHERE id = ?').run(nowIso(), id);
}

function rowToKeyword(row: Record<string, unknown>): Keyword {
  return {
    id: String(row.id),
    phrase: String(row.phrase),
    enabled: Boolean(row.enabled),
    cadenceMinutes: Number(row.cadence_minutes),
    lastFetchedAt: row.last_fetched_at ? String(row.last_fetched_at) : undefined
  };
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

export function setElevenLabsApiKey(apiKey: string) {
  setSetting('elevenlabs.api_key', encryptSecret(apiKey));
}

export function getElevenLabsApiKey() {
  const stored = getSetting('elevenlabs.api_key');
  return stored ? decryptSecret(stored) : process.env.ELEVENLABS_API_KEY || '';
}

export function getElevenLabsVoiceId() {
  return getSetting('elevenlabs.voice_id') || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
}

export function getAllowDemoMode() {
  return getSetting('app.allow_demo_mode') === 'true';
}

export function getAutoScanEnabled() {
  return getSetting('app.auto_scan_enabled') === 'true';
}

export function getAutoScanMinutes() {
  const minutes = Number(getSetting('app.auto_scan_minutes'));
  return Number.isFinite(minutes) && minutes >= 15 ? minutes : 60;
}

export function getScanOnLaunch() {
  return getSetting('app.scan_on_launch') === 'true';
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
  const elevenLabsApiKey = getElevenLabsApiKey();
  const accountName = detectThreadsAccountName();
  return {
    openAiApiKeySet: Boolean(apiKey),
    maskedOpenAiApiKey: apiKey ? maskOpenAiApiKey(apiKey) : undefined,
    openAiModel: getOpenAiModel(),
    elevenLabsApiKeySet: Boolean(elevenLabsApiKey),
    maskedElevenLabsApiKey: elevenLabsApiKey ? maskApiKey(elevenLabsApiKey) : undefined,
    elevenLabsVoiceId: getElevenLabsVoiceId(),
    threadsSessionExists: fs.existsSync(config.threadsStorageState) || fs.existsSync(config.threadsProfileDir),
    threadsAccountName: accountName === 'Your Chromium' ? undefined : accountName,
    language: getLanguage(),
    allowDemoMode: getAllowDemoMode(),
    autoScanEnabled: getAutoScanEnabled(),
    autoScanMinutes: getAutoScanMinutes(),
    scanOnLaunch: getScanOnLaunch()
  };
}

function maskOpenAiApiKey(apiKey: string) {
  if (apiKey.length <= 10) return 'sk-••••••••';
  const prefix = apiKey.slice(0, Math.min(7, apiKey.length));
  const suffix = apiKey.slice(-4);
  return `${prefix}${'•'.repeat(10)}${suffix}`;
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}${'•'.repeat(10)}${apiKey.slice(-4)}`;
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
    affiliateFitScore: Number(row.affiliate_fit_score ?? 0),
    opportunityScore: Number(row.opportunity_score ?? 0),
    velocityScore: Number(row.velocity_score ?? 0),
    engagementGrowthPercent: Number(row.engagement_growth_percent ?? 0),
    emotionalCategory: String(row.emotional_category)
  };
}

function rowToAnalysis(row: Record<string, unknown>): AIAnalysis {
  return {
    postId: String(row.post_id),
    verdict: verdictValue(row.verdict),
    confidenceScore: Number(row.confidence_score ?? 0),
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
    affiliateFitScore: Number(row.affiliate_fit_score ?? 0),
    personas: jsonParse<string[]>(String(row.personas ?? '[]'), []),
    situations: jsonParse<string[]>(String(row.situations ?? '[]'), []),
    demoAngle: String(row.demo_angle ?? ''),
    contentFormat: String(row.content_format ?? ''),
    solutionScript: String(row.solution_script ?? ''),
    productSearchKeywords: jsonParse<string[]>(String(row.product_search_keywords ?? '[]'), []),
    scriptOutline: jsonParse<string[]>(String(row.script_outline ?? '[]'), []),
    rejectReason: row.reject_reason ? String(row.reject_reason) : undefined,
    createdAt: String(row.created_at)
  };
}

function verdictValue(value: unknown): AIAnalysis['verdict'] {
  return value === 'make_now' || value === 'skip' ? value : 'watch';
}
