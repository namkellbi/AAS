export const schema = `
CREATE TABLE IF NOT EXISTS threads_posts (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  author_handle TEXT,
  content TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  image_urls TEXT NOT NULL DEFAULT '[]',
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  keyword TEXT,
  fetched_at TEXT NOT NULL,
  trending_score INTEGER NOT NULL DEFAULT 0,
  affiliate_fit_score INTEGER NOT NULL DEFAULT 0,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  velocity_score INTEGER NOT NULL DEFAULT 0,
  engagement_growth_percent INTEGER NOT NULL DEFAULT 0,
  emotional_category TEXT NOT NULL DEFAULT 'neutral'
);

CREATE INDEX IF NOT EXISTS idx_threads_posts_score ON threads_posts(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_threads_posts_keyword ON threads_posts(keyword);
CREATE INDEX IF NOT EXISTS idx_threads_posts_fetched_at ON threads_posts(fetched_at DESC);

CREATE TABLE IF NOT EXISTS ai_analysis (
  post_id TEXT PRIMARY KEY,
  verdict TEXT NOT NULL DEFAULT 'watch',
  confidence_score INTEGER NOT NULL DEFAULT 0,
  emotion TEXT NOT NULL,
  pain_point TEXT NOT NULL,
  buying_intent TEXT NOT NULL,
  affiliate_categories TEXT NOT NULL,
  affiliate_products TEXT NOT NULL,
  content_angle TEXT NOT NULL,
  why_viral TEXT NOT NULL,
  hooks TEXT NOT NULL,
  ctas TEXT NOT NULL,
  relatability_score INTEGER NOT NULL,
  controversy_score INTEGER NOT NULL,
  affiliate_fit_score INTEGER NOT NULL DEFAULT 0,
  personas TEXT NOT NULL DEFAULT '[]',
  situations TEXT NOT NULL DEFAULT '[]',
  demo_angle TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT '',
  solution_script TEXT NOT NULL DEFAULT '',
  product_search_keywords TEXT NOT NULL DEFAULT '[]',
  script_outline TEXT NOT NULL DEFAULT '[]',
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(post_id) REFERENCES threads_posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL,
  FOREIGN KEY(post_id) REFERENCES threads_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_post_time ON engagement_snapshots(post_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS saved_posts (
  post_id TEXT NOT NULL,
  collection TEXT NOT NULL DEFAULT 'Inbox',
  tags TEXT NOT NULL DEFAULT '[]',
  saved_at TEXT NOT NULL,
  PRIMARY KEY(post_id, collection),
  FOREIGN KEY(post_id) REFERENCES threads_posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  cadence_minutes INTEGER NOT NULL DEFAULT 120,
  last_fetched_at TEXT
);

CREATE TABLE IF NOT EXISTS fetch_logs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  query TEXT,
  status TEXT NOT NULL,
  message TEXT,
  post_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
