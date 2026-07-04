import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/server/config';
import { schema } from '@/server/db/schema';
import { defaultKeywords } from '@/lib/default-keywords';
import { recommendedOpenAIModel } from '@/lib/openai-models';
import { filterUsefulReplies } from '@/lib/replies';
import { detectThreadsAccountName } from '@/server/scraper/threadsScraper';
import { scorePost } from '@/server/scoring/trendingScore';
import type { AIAnalysis, AssetLibraryItem, AssetType, Keyword, KeywordExclusion, KeywordInsight, SavedPost, ThreadsPost, ThreadsReply, TrendState, UploadLogEntry } from '@/lib/types';
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
  pruneUnusedResearchData();
  rescoreStoredPosts(db);
  seedKeywords();
  return db;
}

function rescoreStoredPosts(database: Database.Database) {
  const rows = database.prepare('SELECT * FROM threads_posts').all() as Record<string, unknown>[];
  const update = database.prepare(`
    UPDATE threads_posts
    SET trending_score = ?, affiliate_fit_score = ?, opportunity_score = ?, velocity_score = ?, video_potential_score = ?, emotional_category = ?
    WHERE id = ?
  `);
  const transaction = database.transaction(() => {
    for (const row of rows) {
      const post = rowToPost(row);
      const score = scorePost(post);
      update.run(score.score, score.affiliateFitScore, score.opportunityScore, score.velocityScore, score.videoPotentialScore, score.emotionalCategory, post.id);
    }
  });
  transaction();
}

function migrateSchema(database: Database.Database) {
  ensureColumn(database, 'threads_posts', 'affiliate_fit_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'opportunity_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'velocity_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'engagement_growth_percent', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'top_replies', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'threads_posts', 'trend_state', "TEXT NOT NULL DEFAULT 'EMERGING'");
  ensureColumn(database, 'threads_posts', 'likes_per_hour', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'replies_per_hour', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'threads_posts', 'video_potential_score', 'INTEGER NOT NULL DEFAULT 0');
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
  ensureColumn(database, 'ai_analysis', 'comment_classifications', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'best_replies', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'video_potential_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'ai_analysis', 'video_potential_breakdown', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(database, 'ai_analysis', 'tiktok_caption', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'ai_analysis', 'hashtags', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, 'ai_analysis', 'product_keywords', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(database, 'ai_analysis', 'video_script', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(database, 'keywords', 'source', "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn(database, 'keywords', 'seed_audience', 'TEXT');
  ensureColumn(database, 'keywords', 'created_at', "TEXT NOT NULL DEFAULT ''");
  database.prepare("UPDATE keywords SET created_at = ? WHERE created_at = ''").run(nowIso());
  database.prepare("UPDATE keywords SET source = 'default' WHERE id LIKE 'kw-vi-%' AND source = 'manual'").run();
  ensureColumn(database, 'upload_log', 'hook', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'upload_log', 'content_format', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'upload_log', 'clicks', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'upload_log', 'revenue', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'upload_log', 'commission', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(database, 'upload_log', 'status', "TEXT NOT NULL DEFAULT 'published'");
  database.exec('DROP TABLE IF EXISTS video_queue');
  database
    .prepare("DELETE FROM app_settings WHERE key IN ('video.auto_send_to_queue', 'app.allow_demo_mode', 'elevenlabs.api_key', 'elevenlabs.voice_id')")
    .run();
  database.prepare("DELETE FROM app_settings WHERE key LIKE 'openai.local_%'").run();
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
    INSERT OR IGNORE INTO keywords (id, phrase, enabled, cadence_minutes, last_fetched_at, source, created_at)
    VALUES (@id, @phrase, @enabled, @cadenceMinutes, @lastFetchedAt, 'default', @createdAt)
  `);

  for (const keyword of defaultKeywords) {
    statement.run({
      id: keyword.id,
      phrase: keyword.phrase,
      enabled: keyword.enabled ? 1 : 0,
      cadenceMinutes: keyword.cadenceMinutes,
      lastFetchedAt: keyword.lastFetchedAt ?? null,
      createdAt: nowIso()
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
      , top_replies, trend_state, likes_per_hour, replies_per_hour, video_potential_score
    ) VALUES (
      @id, @author, @authorHandle, @content, @likes, @replies, @reposts, @timestamp, @imageUrls,
      @url, @source, @keyword, @fetchedAt, @trendingScore, @affiliateFitScore, @opportunityScore, @velocityScore, @engagementGrowthPercent, @emotionalCategory
      , @topReplies, @trendState, @likesPerHour, @repliesPerHour, @videoPotentialScore
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
      , top_replies = excluded.top_replies
      , trend_state = excluded.trend_state
      , likes_per_hour = excluded.likes_per_hour
      , replies_per_hour = excluded.replies_per_hour
      , video_potential_score = excluded.video_potential_score
  `);

  const transaction = database.transaction((items: ThreadsPost[]) => {
    for (const post of items) {
      statement.run({ ...post, imageUrls: JSON.stringify(post.imageUrls), topReplies: JSON.stringify(post.topReplies), authorHandle: post.authorHandle ?? null, keyword: post.keyword ?? null });
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
    LIMIT 3
  `);

  return posts.map((post) => {
    const snapshots = latest.all(post.id) as Array<{ likes: number; replies: number; reposts: number; captured_at: string }>;
    const previous = snapshots[0];
    if (!previous) return post;

    const elapsedHours = Math.max((Date.now() - new Date(previous.captured_at).getTime()) / 36e5, 1 / 60);
    const currentEngagement = weightedEngagement(post);
    const previousEngagement = previous.likes + previous.replies * 3 + previous.reposts * 4;
    const delta = Math.max(currentEngagement - previousEngagement, 0);
    const velocityScore = Math.round(clamp(Math.log10(delta / elapsedHours + 1) * 12, 0, 30));
    const engagementGrowthPercent = previousEngagement > 0 ? Math.round(clamp((delta / previousEngagement) * 100, 0, 999)) : 0;
    const likesPerHour = Math.max(0, (post.likes - previous.likes) / elapsedHours);
    const repliesPerHour = Math.max(0, (post.replies - previous.replies) / elapsedHours);
    const previousRate = snapshots[1] ? rateBetweenSnapshots(snapshots[0], snapshots[1]) : 0;
    const olderRate = snapshots[2] ? rateBetweenSnapshots(snapshots[1], snapshots[2]) : 0;
    const trendState = detectTrendState(post.timestamp, likesPerHour, previousRate, olderRate);

    return {
      ...post,
      velocityScore,
      engagementGrowthPercent,
      likesPerHour,
      repliesPerHour,
      trendState
    };
  });
}

function rateBetweenSnapshots(current: { likes: number; captured_at: string }, previous: { likes: number; captured_at: string }) {
  const hours = Math.max((new Date(current.captured_at).getTime() - new Date(previous.captured_at).getTime()) / 36e5, 1 / 60);
  return Math.max(0, (current.likes - previous.likes) / hours);
}

function detectTrendState(timestamp: string, likesPerHour: number, previousRate: number, olderRate: number): TrendState {
  const ageHours = Math.max((Date.now() - new Date(timestamp).getTime()) / 36e5, 0);
  if (ageHours > 72 || likesPerHour < 0.05) return 'DEAD';
  if (ageHours < 6 && likesPerHour > 0) return 'EMERGING';
  if (likesPerHour > previousRate && previousRate >= olderRate) return 'GROWING';
  if (likesPerHour >= previousRate && previousRate >= olderRate) return 'PEAK';
  return 'DECLINING';
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

export function listExistingPostIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const placeholders = ids.map(() => '?').join(',');
  const rows = getDb().prepare(`SELECT id FROM threads_posts WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

export function pruneUnusedResearchData(retentionDays = 7, maxUnusedPosts = 20) {
  const database = getDb();
  const protectedJoins = `
    LEFT JOIN saved_posts saved ON saved.post_id = post.id
    LEFT JOIN ai_analysis analysis ON analysis.post_id = post.id
    LEFT JOIN upload_log uploads ON uploads.post_id = post.id
  `;
  const unusedCondition = `
    saved.post_id IS NULL
    AND analysis.post_id IS NULL
    AND uploads.post_id IS NULL
  `;
  const removeOld = database.prepare(`
    DELETE FROM threads_posts
    WHERE id IN (
      SELECT DISTINCT post.id
      FROM threads_posts post
      ${protectedJoins}
      WHERE ${unusedCondition}
        AND datetime(post.fetched_at) < datetime('now', ?)
    )
  `);
  const removeOverflow = database.prepare(`
    DELETE FROM threads_posts
    WHERE id IN (
      SELECT id FROM (
        SELECT DISTINCT post.id, post.fetched_at
        FROM threads_posts post
        ${protectedJoins}
        WHERE ${unusedCondition}
        ORDER BY datetime(post.fetched_at) DESC
        LIMIT -1 OFFSET ?
      )
    )
  `);
  const transaction = database.transaction(() => {
    const old = removeOld.run(`-${retentionDays} days`).changes;
    const overflow = removeOverflow.run(maxUnusedPosts).changes;
    database.prepare("DELETE FROM fetch_logs WHERE datetime(started_at) < datetime('now', '-30 days')").run();
    return old + overflow;
  });
  return transaction();
}

export function storeAnalysis(analysis: AIAnalysis) {
  getDb()
    .prepare(`
      INSERT INTO ai_analysis (
        post_id, verdict, confidence_score, emotion, pain_point, buying_intent, affiliate_categories, affiliate_products,
        content_angle, why_viral, hooks, ctas, relatability_score, controversy_score, created_at
        , affiliate_fit_score, personas, situations, demo_angle, content_format, solution_script, product_search_keywords, script_outline, reject_reason
        , comment_classifications, best_replies, video_potential_score, video_potential_breakdown, tiktok_caption, hashtags, product_keywords, video_script
      ) VALUES (
        @postId, @verdict, @confidenceScore, @emotion, @painPoint, @buyingIntent, @affiliateCategories, @affiliateProducts,
        @contentAngle, @whyViral, @hooks, @ctas, @relatabilityScore, @controversyScore, @createdAt
        , @affiliateFitScore, @personas, @situations, @demoAngle, @contentFormat, @solutionScript, @productSearchKeywords, @scriptOutline, @rejectReason
        , @commentClassifications, @bestReplies, @videoPotentialScore, @videoPotentialBreakdown, @tiktokCaption, @hashtags, @productKeywords, @videoScript
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
        comment_classifications = excluded.comment_classifications,
        best_replies = excluded.best_replies,
        video_potential_score = excluded.video_potential_score,
        video_potential_breakdown = excluded.video_potential_breakdown,
        tiktok_caption = excluded.tiktok_caption,
        hashtags = excluded.hashtags,
        product_keywords = excluded.product_keywords,
        video_script = excluded.video_script,
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
      commentClassifications: JSON.stringify(analysis.commentClassifications),
      bestReplies: JSON.stringify(analysis.bestReplies),
      videoPotentialBreakdown: JSON.stringify(analysis.videoPotentialBreakdown),
      hashtags: JSON.stringify(analysis.hashtags),
      productKeywords: JSON.stringify(analysis.marketplaceKeywords),
      videoScript: JSON.stringify(analysis.videoScript),
      rejectReason: analysis.rejectReason ?? null
    });

  getDb()
    .prepare(`
      UPDATE threads_posts
      SET video_potential_score = ?,
          opportunity_score = ROUND(affiliate_fit_score * 0.4 + ? * 0.3 + velocity_score * 0.2 + trending_score * 0.1)
      WHERE id = ?
    `)
    .run(analysis.videoPotentialScore, analysis.videoPotentialScore, analysis.postId);
}

export function getAnalysis(postId: string): AIAnalysis | null {
  const row = getDb().prepare('SELECT * FROM ai_analysis WHERE post_id = ?').get(postId) as Record<string, unknown> | undefined;
  return row ? rowToAnalysis(row) : null;
}

export function listAnalyses(limit = 200): AIAnalysis[] {
  const rows = getDb().prepare('SELECT * FROM ai_analysis ORDER BY datetime(created_at) DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(rowToAnalysis);
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

export function addKeyword(input: { phrase: string; source?: Keyword['source']; seedAudience?: string }): Keyword {
  const normalized = input.phrase.trim();
  if (!normalized) throw new Error('Keyword cannot be empty.');
  const duplicate = getDb().prepare('SELECT * FROM keywords WHERE lower(phrase) = lower(?)').get(normalized) as Record<string, unknown> | undefined;
  if (duplicate) throw new Error(`Keyword "${normalized}" already exists.`);

  const keyword: Keyword = {
    id: crypto.randomUUID(),
    phrase: normalized,
    enabled: true,
    cadenceMinutes: 120,
    source: keywordSourceValue(input.source),
    seedAudience: input.seedAudience?.trim() || undefined,
    createdAt: nowIso()
  };

  getDb()
    .prepare('INSERT INTO keywords (id, phrase, enabled, cadence_minutes, last_fetched_at, source, seed_audience, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(keyword.id, keyword.phrase, 1, keyword.cadenceMinutes, null, keyword.source, keyword.seedAudience ?? null, keyword.createdAt);

  return keyword;
}

export function listKeywords(): Keyword[] {
  const rows = getDb().prepare('SELECT * FROM keywords ORDER BY phrase ASC').all() as Record<string, unknown>[];
  return rows.map(rowToKeyword);
}

export function listKeywordInsights(): KeywordInsight[] {
  const database = getDb();
  const keywords = listKeywords();
  const postRows = database.prepare(`
    SELECT
      lower(post.keyword) AS phrase,
      COUNT(DISTINCT post.id) AS current_posts,
      AVG(post.opportunity_score) AS average_opportunity_score,
      COUNT(DISTINCT analysis.post_id) AS analyzed_posts,
      COUNT(DISTINCT CASE WHEN analysis.verdict = 'make_now' THEN analysis.post_id END) AS make_now_posts,
      COUNT(DISTINCT CASE WHEN analysis.verdict = 'watch' THEN analysis.post_id END) AS watch_posts,
      COUNT(DISTINCT CASE
        WHEN analysis.pain_point IS NOT NULL
          AND trim(analysis.pain_point) <> ''
          AND lower(analysis.pain_point) NOT LIKE '%unclear%'
        THEN analysis.post_id END
      ) AS pain_point_posts,
      COUNT(DISTINCT CASE
        WHEN analysis.affiliate_products IS NOT NULL
          AND analysis.affiliate_products <> '[]'
        THEN analysis.post_id END
      ) AS product_fit_posts
    FROM threads_posts post
    LEFT JOIN ai_analysis analysis ON analysis.post_id = post.id
    WHERE post.keyword IS NOT NULL
    GROUP BY lower(post.keyword)
  `).all() as Array<Record<string, unknown>>;
  const fetchRows = database.prepare(`
    SELECT lower(query) AS phrase, COUNT(*) AS scan_count, SUM(post_count) AS fetched_posts
    FROM fetch_logs
    WHERE mode = 'keyword' AND status = 'success' AND query IS NOT NULL
    GROUP BY lower(query)
  `).all() as Array<Record<string, unknown>>;
  const resultRows = database.prepare(`
    SELECT lower(post.keyword) AS phrase, SUM(upload.orders) AS orders, SUM(upload.commission) AS commission
    FROM upload_log upload
    JOIN threads_posts post ON post.id = upload.post_id
    WHERE post.keyword IS NOT NULL
    GROUP BY lower(post.keyword)
  `).all() as Array<Record<string, unknown>>;
  const postsByPhrase = keyedRows(postRows);
  const fetchesByPhrase = keyedRows(fetchRows);
  const resultsByPhrase = keyedRows(resultRows);

  return keywords.map((keyword) => {
    const key = keyword.phrase.toLowerCase();
    const posts = postsByPhrase.get(key) ?? {};
    const fetches = fetchesByPhrase.get(key) ?? {};
    const results = resultsByPhrase.get(key) ?? {};
    return buildKeywordInsight(keyword.id, posts, fetches, results);
  });
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

export function listKeywordExclusions(): KeywordExclusion[] {
  const rows = getDb().prepare('SELECT * FROM keyword_exclusions ORDER BY phrase ASC').all() as Array<{ id: string; phrase: string }>;
  return rows.map((row) => ({ id: row.id, phrase: row.phrase }));
}

export function addKeywordExclusion(phrase: string): KeywordExclusion {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) throw new Error('Excluded phrase cannot be empty.');
  const existing = getDb().prepare('SELECT * FROM keyword_exclusions WHERE lower(phrase) = lower(?)').get(normalized) as KeywordExclusion | undefined;
  if (existing) return existing;
  const item = { id: crypto.randomUUID(), phrase: normalized };
  getDb().prepare('INSERT INTO keyword_exclusions (id, phrase) VALUES (?, ?)').run(item.id, item.phrase);
  return item;
}

export function deleteKeywordExclusion(id: string) {
  getDb().prepare('DELETE FROM keyword_exclusions WHERE id = ?').run(id);
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
    lastFetchedAt: row.last_fetched_at ? String(row.last_fetched_at) : undefined,
    source: keywordSourceValue(row.source),
    seedAudience: row.seed_audience ? String(row.seed_audience) : undefined,
    createdAt: String(row.created_at || nowIso())
  };
}

function keywordSourceValue(value: unknown): Keyword['source'] {
  return value === 'default' || value === 'ai_audience' || value === 'ai_expansion' ? value : 'manual';
}

function keyedRows(rows: Array<Record<string, unknown>>) {
  return new Map(rows.map((row) => [String(row.phrase ?? '').toLowerCase(), row]));
}

function buildKeywordInsight(
  keywordId: string,
  posts: Record<string, unknown>,
  fetches: Record<string, unknown>,
  results: Record<string, unknown>
): KeywordInsight {
  const scanCount = Number(fetches.scan_count ?? 0);
  const fetchedPosts = Number(fetches.fetched_posts ?? 0);
  const currentPosts = Number(posts.current_posts ?? 0);
  const analyzedPosts = Number(posts.analyzed_posts ?? 0);
  const makeNowPosts = Number(posts.make_now_posts ?? 0);
  const watchPosts = Number(posts.watch_posts ?? 0);
  const painPointPosts = Number(posts.pain_point_posts ?? 0);
  const productFitPosts = Number(posts.product_fit_posts ?? 0);
  const averageOpportunityScore = Math.round(Number(posts.average_opportunity_score ?? 0));
  const orders = Number(results.orders ?? 0);
  const commission = Number(results.commission ?? 0);
  const analyzedBase = Math.max(analyzedPosts, 1);
  const qualityRate = (makeNowPosts + watchPosts * 0.4) / analyzedBase;
  const painRate = painPointPosts / analyzedBase;
  const productRate = productFitPosts / analyzedBase;
  const dataYield = Math.min(Math.max(fetchedPosts, currentPosts) / 20, 1);
  const commerceSignal = Math.min(orders / 5 + commission / 500_000, 1);
  const score = Math.round(
    Math.min(
      100,
      dataYield * 15 +
        qualityRate * 30 +
        painRate * 15 +
        productRate * 15 +
        (averageOpportunityScore / 100) * 15 +
        commerceSignal * 10
    )
  );
  const status: KeywordInsight['status'] =
    orders > 0 || (score >= 65 && makeNowPosts > 0)
      ? 'potential'
      : scanCount >= 2 && fetchedPosts >= 10 && makeNowPosts === 0 && score < 40
        ? 'poor'
        : 'testing';
  const recommendation: KeywordInsight['recommendation'] = status === 'potential' ? 'keep' : status === 'poor' ? 'disable' : 'test';

  return {
    keywordId,
    scanCount,
    fetchedPosts,
    currentPosts,
    analyzedPosts,
    makeNowPosts,
    watchPosts,
    painPointPosts,
    productFitPosts,
    averageOpportunityScore,
    orders,
    commission,
    score,
    status,
    recommendation
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

export function getTiktokChannelName() {
  return getSetting('video.tiktok_channel_name') || '@yourchannel';
}

export function getDefaultVoice(): 'onyx' | 'nova' | 'shimmer' {
  const value = getSetting('video.default_voice');
  return value === 'nova' || value === 'shimmer' ? value : 'onyx';
}

export function getDefaultSpeed() {
  const value = Number(getSetting('video.default_speed'));
  return Number.isFinite(value) ? clamp(value, 0.9, 1.3) : 1.1;
}

export function getTransitionSoundEnabled() {
  return getSetting('video.transition_sound_enabled') === 'true';
}

export function getPostAgeHours() {
  const value = Number(getSetting('scraper.post_age_hours'));
  return Number.isFinite(value) && value > 0 ? Math.round(clamp(value, 1, 168)) : 24;
}

export function getLanguage() {
  const language = getSetting('app.language');
  return language === 'vi' || language === 'en' ? language : 'en';
}

export function listAssets(): AssetLibraryItem[] {
  const rows = getDb().prepare('SELECT * FROM asset_library ORDER BY times_used ASC, label ASC').all() as Record<string, unknown>[];
  const items = rows.map(rowToAsset);
  const existing = items.filter((item) => fs.existsSync(item.filePath));
  if (existing.length !== items.length) {
    const remove = getDb().prepare('DELETE FROM asset_library WHERE id = ?');
    getDb().transaction((stale: AssetLibraryItem[]) => stale.forEach((item) => remove.run(item.id)))(items.filter((item) => !fs.existsSync(item.filePath)));
  }
  return existing;
}

export function getAsset(id: string): AssetLibraryItem | null {
  const row = getDb().prepare('SELECT * FROM asset_library WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAsset(row) : null;
}

export function addAsset(type: AssetType, filePath: string, durationSecs: number, label?: string): AssetLibraryItem {
  const existing = getDb().prepare('SELECT * FROM asset_library WHERE file_path = ?').get(filePath) as Record<string, unknown> | undefined;
  if (existing) {
    if (label && label !== String(existing.label)) {
      getDb().prepare('UPDATE asset_library SET label = ?, type = ?, duration_secs = ? WHERE id = ?').run(label, type, durationSecs, String(existing.id));
      return { ...rowToAsset(existing), label, type, durationSecs };
    }
    return rowToAsset(existing);
  }
  const item: AssetLibraryItem = {
    id: crypto.randomUUID(),
    type,
    label: label ?? path.basename(filePath, path.extname(filePath)),
    filePath,
    durationSecs,
    timesUsed: 0
  };
  getDb().prepare('INSERT INTO asset_library (id, type, label, file_path, duration_secs) VALUES (?, ?, ?, ?, ?)').run(item.id, item.type, item.label, item.filePath, item.durationSecs);
  return item;
}

export function deleteAsset(id: string) {
  getDb().prepare('DELETE FROM asset_library WHERE id = ?').run(id);
}

export function markAssetUsed(filePath?: string) {
  if (!filePath) return;
  getDb().prepare('UPDATE asset_library SET times_used = times_used + 1, last_used_at = ? WHERE file_path = ?').run(nowIso(), filePath);
}

export function listUploadLogs(): UploadLogEntry[] {
  const rows = getDb().prepare('SELECT * FROM upload_log ORDER BY uploaded_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToUploadLog);
}

export function saveUploadLog(entry: UploadLogEntry): UploadLogEntry {
  const id = entry.id || crypto.randomUUID();
  getDb()
    .prepare(`
      INSERT INTO upload_log (
        id, post_id, tiktok_url, product_name, hook, content_format, uploaded_at,
        views, clicks, orders, revenue, commission, status, note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET post_id = excluded.post_id, tiktok_url = excluded.tiktok_url,
        product_name = excluded.product_name, hook = excluded.hook, content_format = excluded.content_format,
        uploaded_at = excluded.uploaded_at, views = excluded.views, clicks = excluded.clicks,
        orders = excluded.orders, revenue = excluded.revenue, commission = excluded.commission,
        status = excluded.status, note = excluded.note
    `)
    .run(
      id,
      entry.postId,
      entry.tiktokUrl,
      entry.productName,
      entry.hook,
      entry.contentFormat,
      entry.uploadedAt || nowIso(),
      entry.views,
      entry.clicks,
      entry.orders,
      entry.revenue,
      entry.commission,
      entry.status,
      entry.note
    );
  return { ...entry, id, uploadedAt: entry.uploadedAt || nowIso() };
}

export function deleteUploadLog(id: string) {
  getDb().prepare('DELETE FROM upload_log WHERE id = ?').run(id);
}

export function getAffiliatePerformanceContext() {
  const rows = getDb()
    .prepare(`
      SELECT product_name, hook, content_format, views, clicks, orders, revenue, commission
      FROM upload_log
      WHERE status <> 'stopped'
      ORDER BY commission DESC, orders DESC, clicks DESC
      LIMIT 12
    `)
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    productName: String(row.product_name ?? ''),
    hook: String(row.hook ?? ''),
    contentFormat: String(row.content_format ?? ''),
    views: Number(row.views ?? 0),
    clicks: Number(row.clicks ?? 0),
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
    commission: Number(row.commission ?? 0)
  }));
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
    autoScanEnabled: getAutoScanEnabled(),
    autoScanMinutes: getAutoScanMinutes(),
    scanOnLaunch: getScanOnLaunch()
    , tiktokChannelName: getTiktokChannelName()
    , defaultVoice: getDefaultVoice()
    , defaultSpeed: getDefaultSpeed()
    , transitionSoundEnabled: getTransitionSoundEnabled()
    , postAgeHours: getPostAgeHours()
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
  if (!safeStorage?.isEncryptionAvailable()) throw new Error('Secure storage is unavailable. API keys were not saved.');
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
    , topReplies: filterUsefulReplies(jsonParse<ThreadsReply[]>(String(row.top_replies ?? '[]'), []))
    , trendState: trendStateValue(row.trend_state)
    , likesPerHour: Number(row.likes_per_hour ?? 0)
    , repliesPerHour: Number(row.replies_per_hour ?? 0)
    , videoPotentialScore: Number(row.video_potential_score ?? 0)
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
    commentClassifications: jsonParse(String(row.comment_classifications ?? '[]'), []),
    bestReplies: jsonParse(String(row.best_replies ?? '[]'), []),
    videoPotentialScore: Number(row.video_potential_score ?? 0),
    videoPotentialBreakdown: jsonParse(String(row.video_potential_breakdown ?? '{}'), { visual: 0, demo: 0, emotional: 0, curiosity: 0 }),
    tiktokCaption: String(row.tiktok_caption ?? ''),
    hashtags: jsonParse(String(row.hashtags ?? '[]'), []),
    marketplaceKeywords: jsonParse(String(row.product_keywords ?? '{}'), { tiktokShop: '', shopee: '' }),
    videoScript: normalizeStoredVideoScript(row.video_script, row.solution_script),
    createdAt: String(row.created_at)
  };
}

function normalizeStoredVideoScript(value: unknown, fallbackSolution: unknown): AIAnalysis['videoScript'] {
  const parsed = jsonParse<Partial<AIAnalysis['videoScript']>>(String(value ?? '{}'), {});
  return {
    postReadVersion: parsed.postReadVersion ?? '',
    transitionLine: parsed.transitionLine ?? '',
    solutionText: parsed.solutionText ?? String(fallbackSolution ?? ''),
    ctaText: parsed.ctaText ?? '',
    captionVariants: Array.isArray(parsed.captionVariants) ? parsed.captionVariants : []
  };
}

function trendStateValue(value: unknown): TrendState {
  return value === 'GROWING' || value === 'PEAK' || value === 'DECLINING' || value === 'DEAD' ? value : 'EMERGING';
}

function verdictValue(value: unknown): AIAnalysis['verdict'] {
  return value === 'make_now' || value === 'skip' ? value : 'watch';
}

function rowToAsset(row: Record<string, unknown>): AssetLibraryItem {
  return {
    id: String(row.id),
    type: row.type as AssetType,
    label: String(row.label),
    filePath: String(row.file_path),
    durationSecs: Number(row.duration_secs ?? 0),
    timesUsed: Number(row.times_used ?? 0),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined
  };
}

function rowToUploadLog(row: Record<string, unknown>): UploadLogEntry {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    tiktokUrl: String(row.tiktok_url ?? ''),
    productName: String(row.product_name ?? ''),
    hook: String(row.hook ?? ''),
    contentFormat: String(row.content_format ?? ''),
    uploadedAt: String(row.uploaded_at),
    views: Number(row.views ?? 0),
    clicks: Number(row.clicks ?? 0),
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
    commission: Number(row.commission ?? 0),
    status: uploadStatusValue(row.status),
    note: String(row.note ?? '')
  };
}

function uploadStatusValue(value: unknown): UploadLogEntry['status'] {
  return value === 'tracking' || value === 'winner' || value === 'stopped' ? value : 'published';
}
