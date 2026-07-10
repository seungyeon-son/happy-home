/**
 * 스크래퍼 실행 진입점 (1단계 검증용).
 * 2단계에서 SQLite 저장 파이프라인이 이 자리에 연결된다.
 *
 *   npm run scrape          # 각 소스 1페이지 수집 후 요약 출력
 *   npm run scrape -- 3     # 3페이지까지 수집
 */
import { lhSource } from './sources/lh.js';
import type { NoticeSource } from './types.js';

const sources: NoticeSource[] = [lhSource];
const maxPages = Number(process.argv[2]) || 1;

for (const source of sources) {
  const started = Date.now();
  const notices = await source.fetchNotices({ maxPages });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n■ ${source.name} — ${notices.length}건 수집 (${elapsed}s)\n`);
  for (const n of notices.slice(0, 10)) {
    console.log(
      `  [${n.category}] ${n.title}\n` +
        `    ${n.region} | 게시 ${n.postedAt} → 마감 ${n.closesAt ?? '-'} | ${n.status ?? '-'}\n` +
        `    ${n.detailUrl}\n`,
    );
  }
  if (notices.length > 10) console.log(`  ... 외 ${notices.length - 10}건`);
}
