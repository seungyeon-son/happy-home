/**
 * 수집 파이프라인: 모든 소스 → 정규화 → upsert.
 * 몇 번을 재실행해도 결과가 같은 멱등(idempotent) 구조라 크론에 그대로 걸 수 있다.
 * 한 소스가 실패해도 나머지 소스는 계속 수집한다.
 *
 *   npm run ingest          # 각 소스 1페이지
 *   npm run ingest -- 3     # 3페이지까지 (최초 백필용)
 */
import { lhSource } from '../scraper/sources/lh.js';
import { shSource } from '../scraper/sources/sh.js';
import { upsertNotices, countNotices } from '../db/notices.js';
import type { NoticeSource } from '../scraper/types.js';

export const sources: NoticeSource[] = [lhSource, shSource];

export interface SourceSummary {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  error?: string;
}

export async function ingestAll(maxPages = 1): Promise<SourceSummary[]> {
  const summaries: SourceSummary[] = [];
  for (const source of sources) {
    const started = Date.now();
    try {
      const notices = await source.fetchNotices({ maxPages });
      const r = await upsertNotices(notices);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `[${new Date().toISOString()}] ${source.name}: 수집 ${notices.length}건 → 신규 ${r.inserted} / 변경 ${r.updated} / 동일 ${r.unchanged} (${elapsed}s)`,
      );
      summaries.push({ source: source.id, fetched: notices.length, ...r });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ${source.name} 수집 실패:`, err);
      summaries.push({
        source: source.id,
        fetched: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        error: String(err),
      });
    }
  }
  console.log(`DB 누적 공고 수: ${await countNotices()}건`);
  return summaries;
}

// CLI로 직접 실행된 경우
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  await ingestAll(Number(process.argv[2]) || 1);
}
