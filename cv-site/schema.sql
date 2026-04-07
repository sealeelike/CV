-- CV Site Database Schema

-- 访客记录
CREATE TABLE IF NOT EXISTS guests (
  guest_id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT,
  fingerprint TEXT,
  fingerprint_raw TEXT,  -- JSON: {ua, lang, screen, colorDepth, timezone, cpu, platform}
  user_agent TEXT,
  geo_country TEXT,
  geo_city TEXT,
  magic_link_id TEXT,
  consent_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文件请求记录
CREATE TABLE IF NOT EXISTS file_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_code TEXT,  -- e.g. REQ-A3F7K2, shown in watermark and email
  guest_id INTEGER REFERENCES guests(guest_id),
  recipient_email TEXT NOT NULL,
  file_list TEXT NOT NULL,  -- JSON array of file keys
  status TEXT DEFAULT 'pending',  -- pending / sent / failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 留言记录
CREATE TABLE IF NOT EXISTS messages (
  message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER,
  name TEXT,
  email TEXT,
  content TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Magic Links
CREATE TABLE IF NOT EXISTS magic_links (
  link_id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  label TEXT,  -- e.g. "Google HR - March 2026"
  asset_id TEXT REFERENCES assets(asset_id),
  allowed_files TEXT,  -- JSON array of file keys
  expires_at DATETIME,
  max_uses INTEGER,
  require_email INTEGER DEFAULT 1,  -- 1=enforce whitelist, 0=skip
  variant_assets TEXT,              -- JSON: [{"asset_id":"...","label":"EN"}, ...]
  use_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Assets (Theme + CV data pairs)
CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'cv_page',
  theme_name TEXT NOT NULL,
  cv_data TEXT NOT NULL,            -- JSON (CVData)
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration: add columns that may be missing in existing deployments
-- (safe to re-run; D1/SQLite will error if column exists, but wrangler ignores DDL errors by default)
-- Feature 18: email restriction toggle
-- ALTER TABLE magic_links ADD COLUMN require_email INTEGER DEFAULT 1;
-- Feature 19: variant assets
-- ALTER TABLE magic_links ADD COLUMN variant_assets TEXT;

-- 链接访问日志（verify-magic 服务端记录，不依赖客户端 JS）
CREATE TABLE IF NOT EXISTS link_accesses (
  access_id INTEGER PRIMARY KEY AUTOINCREMENT,
  magic_link_id TEXT NOT NULL REFERENCES magic_links(link_id),
  ip TEXT,
  user_agent TEXT,
  geo_country TEXT,
  geo_city TEXT,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guests_consent_time ON guests(consent_time);
CREATE INDEX IF NOT EXISTS idx_link_accesses_magic_link ON link_accesses(magic_link_id);
CREATE INDEX IF NOT EXISTS idx_link_accesses_time ON link_accesses(accessed_at);
CREATE INDEX IF NOT EXISTS idx_file_requests_guest ON file_requests(guest_id);
CREATE INDEX IF NOT EXISTS idx_file_requests_status ON file_requests(status);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_assets_default ON assets(is_default);
