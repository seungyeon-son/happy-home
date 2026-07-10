/**
 * 백엔드 API 서버 (Hono).
 *
 *   GET /api/notices  — 공고 목록. 쿼리: region, category, source, q(제목 검색),
 *                       open=1(마감 안 지난 것만), sort=latest|deadline, page, limit
 *   GET /api/meta     — 필터 UI 용 메타 (지역/유형/소스별 건수, 총계, 마지막 수집 시각)
 *   GET /api/health   — 헬스체크
 *
 * 수집 데몬 통합: 기동 시 1회 + 30분 간격으로 ingest 실행.
 * DISABLE_INGEST=1 로 끄고 별도 프로세스(npm run watch)로 분리 운영도 가능.
 *
 *   npm run server
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import cron from 'node-cron';
import { queryNotices, queryMeta } from '../db/queries.js';
import { ingestAll } from '../pipeline/ingest.js';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/notices', (c) => {
  const p = c.req.query();
  return c.json(
    queryNotices({
      region: p.region || undefined,
      category: p.category || undefined,
      source: p.source || undefined,
      q: p.q || undefined,
      openOnly: p.open === '1',
      sort: p.sort === 'deadline' ? 'deadline' : 'latest',
      page: Number(p.page) || 1,
      limit: Number(p.limit) || 24,
    }),
  );
});

app.get('/api/meta', (c) => c.json(queryMeta()));

// 4단계 프론트엔드 빌드 산출물 서빙 (web/dist)
app.use('*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ root: './web/dist', path: 'index.html' }));

const port = Number(process.env.PORT) || 3000;

if (process.env.DISABLE_INGEST !== '1') {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await ingestAll();
    } catch (err) {
      console.error('수집 실패:', err);
    } finally {
      running = false;
    }
  };
  void tick(); // 기동 직후 1회 (서버 리슨을 막지 않도록 비동기로)
  cron.schedule('*/30 * * * *', tick);
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`API 서버 기동: http://localhost:${port}`);
});
