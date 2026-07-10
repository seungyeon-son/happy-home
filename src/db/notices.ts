import { getDb } from './index.js';
import type { Notice } from '../scraper/types.js';

export interface IngestResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * 공고 목록을 upsert 한다.
 * - 신규: INSERT (first_seen_at 기록)
 * - 기존인데 내용 변경(정정공고로 제목/마감일/상태가 바뀌는 경우가 실제로 흔함): UPDATE
 * - 기존 + 내용 동일: last_seen_at 만 갱신
 * 전체를 단일 트랜잭션으로 묶어 수집 도중 실패 시 반쪽짜리 상태를 남기지 않는다.
 */
export function upsertNotices(notices: Notice[]): IngestResult {
  const db = getDb();
  const now = new Date().toISOString();

  const selectStmt = db.prepare(
    'SELECT category, title, region, posted_at, closes_at, status, detail_url FROM notices WHERE source = ? AND external_id = ?',
  );
  const insertStmt = db.prepare(`
    INSERT INTO notices (source, external_id, category, title, region, posted_at, closes_at, status, detail_url, first_seen_at, last_seen_at)
    VALUES (@source, @externalId, @category, @title, @region, @postedAt, @closesAt, @status, @detailUrl, @now, @now)
  `);
  const updateStmt = db.prepare(`
    UPDATE notices
    SET category = @category, title = @title, region = @region, posted_at = @postedAt,
        closes_at = @closesAt, status = @status, detail_url = @detailUrl, last_seen_at = @now
    WHERE source = @source AND external_id = @externalId
  `);
  const touchStmt = db.prepare(
    'UPDATE notices SET last_seen_at = ? WHERE source = ? AND external_id = ?',
  );

  const run = db.transaction((items: Notice[]): IngestResult => {
    const result: IngestResult = { inserted: 0, updated: 0, unchanged: 0 };
    for (const n of items) {
      const existing = selectStmt.get(n.source, n.externalId) as
        | {
            category: string;
            title: string;
            region: string;
            posted_at: string;
            closes_at: string | null;
            status: string | null;
            detail_url: string;
          }
        | undefined;

      if (!existing) {
        insertStmt.run({ ...n, now });
        result.inserted++;
      } else if (
        existing.category !== n.category ||
        existing.title !== n.title ||
        existing.region !== n.region ||
        existing.posted_at !== n.postedAt ||
        existing.closes_at !== n.closesAt ||
        existing.status !== n.status ||
        existing.detail_url !== n.detailUrl
      ) {
        updateStmt.run({ ...n, now });
        result.updated++;
      } else {
        touchStmt.run(now, n.source, n.externalId);
        result.unchanged++;
      }
    }
    return result;
  });

  return run(notices);
}

export function countNotices(): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM notices').get() as { c: number }).c;
}
