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
  emotional_category TEXT NOT NULL DEFAULT 'neutral',
  top_replies TEXT NOT NULL DEFAULT '[]',
  trend_state TEXT NOT NULL DEFAULT 'EMERGING',
  likes_per_hour REAL NOT NULL DEFAULT 0,
  replies_per_hour REAL NOT NULL DEFAULT 0,
  video_potential_score INTEGER NOT NULL DEFAULT 0
);

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
  reject_reason TEXT,
  comment_classifications TEXT NOT NULL DEFAULT '[]',
  best_replies TEXT NOT NULL DEFAULT '[]',
  video_potential_score INTEGER NOT NULL DEFAULT 0,
  video_potential_breakdown TEXT NOT NULL DEFAULT '{}',
  tiktok_caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '[]',
  product_keywords TEXT NOT NULL DEFAULT '{}',
  video_script TEXT NOT NULL DEFAULT '{}',
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
  last_fetched_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  seed_audience TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_exclusions (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL UNIQUE
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

CREATE TABLE IF NOT EXISTS asset_library (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  duration_secs REAL NOT NULL DEFAULT 0,
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS upload_log (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  tiktok_url TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(post_id) REFERENCES threads_posts(id) ON DELETE CASCADE
);
