import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * DB 연결 (libsql).
 * - 프로덕션: Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 * - 로컬: 파일 SQLite (file:data/happy-home.db) — 기존 DB 파일 그대로 호환
 * - UNIQUE(source, external_id) 제약으로 중복 저장 원천 차단
 */

let client: Client | null = null;
let schemaReady = false;

export function getDb(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? 'file:data/happy-home.db';
  if (url.startsWith('file:')) {
    mkdirSync(path.dirname(url.slice('file:'.length)) || '.', { recursive: true });
  }
  client = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });
  return client;
}

/** 스키마 보장. 프로세스당 1회만 실제 실행 (서버리스 콜드스타트 대비 IF NOT EXISTS). */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await getDb().batch(
    [
      `CREATE TABLE IF NOT EXISTS notices (
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
      )`,
      'CREATE INDEX IF NOT EXISTS idx_notices_posted_at ON notices (posted_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_notices_region ON notices (region)',
      'CREATE INDEX IF NOT EXISTS idx_notices_category ON notices (category)',
    ],
    'write',
  );
  schemaReady = true;
}
