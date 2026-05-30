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
  emotional_category TEXT NOT NULL DEFAULT 'neutral'
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  post_id TEXT PRIMARY KEY,
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
  created_at TEXT NOT NULL,
  FOREIGN KEY(post_id) REFERENCES threads_posts(id) ON DELETE CASCADE
);

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
