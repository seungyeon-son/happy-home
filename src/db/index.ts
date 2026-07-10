import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * SQLite 연결 + 스키마.
 * - UNIQUE(source, external_id): 중복 저장을 DB 제약으로 원천 차단
 * - first_seen_at / last_seen_at: 신규 감지와 "목록에서 사라진 공고" 판별에 사용
 * - WAL 모드: 수집(쓰기)과 API 서빙(읽기)이 동시에 일어나도 안전
 */

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'happy-home.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notices (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source        TEXT NOT NULL,
      external_id   TEXT NOT NULL,
      category      TEXT NOT NULL,
      title         TEXT NOT NULL,
      region        TEXT NOT NULL,
      posted_at     TEXT NOT NULL,
      closes_at     TEXT,
      status        TEXT,
      detail_url    TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at  TEXT NOT NULL,
      UNIQUE (source, external_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notices_posted_at ON notices (posted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notices_region ON notices (region);
    CREATE INDEX IF NOT EXISTS idx_notices_category ON notices (category);
  `);
  return db;
}
