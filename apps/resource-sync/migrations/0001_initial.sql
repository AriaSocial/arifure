PRAGMA foreign_keys = ON;

CREATE TABLE resource_state (
  resource TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE localize_entries (
  locale TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (locale, key)
);

CREATE INDEX idx_localize_entries_key
  ON localize_entries (key);

CREATE TABLE notices (
  notice_key TEXT PRIMARY KEY,
  sort TEXT NOT NULL,
  stime TEXT NOT NULL,
  etime TEXT NOT NULL,
  utime TEXT NOT NULL,
  lasts_time INTEGER NOT NULL,
  laste_time INTEGER NOT NULL,
  lastu_time INTEGER NOT NULL,
  coverpic TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  first_seen_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER
);

CREATE INDEX idx_notices_active_sort
  ON notices (active, sort);

CREATE TABLE notice_translations (
  notice_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (notice_key, locale),
  FOREIGN KEY (notice_key) REFERENCES notices(notice_key) ON DELETE CASCADE
);

CREATE INDEX idx_notice_translations_locale
  ON notice_translations (locale);
