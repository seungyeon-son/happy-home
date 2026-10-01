/**
 * 로컬·자체 호스팅용 앱 — SQLite(libsql) 저장소 + 수집 트리거 엔드포인트.
 * Vercel 함수는 이 파일을 쓰지 않는다 (api/[[...path]].ts 가 live 저장소로 직접 구성).
 */
import * as dbStore from '../db/queries.js';
import { ingestAll } from '../pipeline/ingest.js';
import { createApp } from './create-app.js';

export const app = createApp(dbStore, 'db');

// 외부 크론이 호출하는 수집 엔드포인트 (CRON_SECRET 설정 시 Bearer 인증 필수)
app.on(['GET', 'POST'], '/api/ingest', async (c) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = c.req.header('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) return c.json({ error: 'unauthorized' }, 401);
  }
  const summary = await ingestAll();
  return c.json({ ok: true, summary });
});
