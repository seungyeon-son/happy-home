/**
 * 공용 Hono 앱 — 로컬 서버(index.ts)와 Vercel 함수(api/) 양쪽에서 사용.
 *
 *   GET  /api/notices  — 공고 목록 (region, category, categories, q, open, sort, page, limit)
 *   GET  /api/meta     — 필터 UI 용 메타데이터
 *   GET  /api/health   — 헬스체크
 *   POST /api/ingest   — 수집 트리거 (CRON_SECRET 설정 시 Bearer 인증 필수)
 */
import { Hono } from 'hono';
import { queryNotices, queryMeta } from '../db/queries.js';
import { ingestAll } from '../pipeline/ingest.js';

export const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/notices', async (c) => {
  const p = c.req.query();
  return c.json(
    await queryNotices({
      region: p.region || undefined,
      category: p.category || undefined,
      categories: p.categories ? p.categories.split(',').filter(Boolean) : undefined,
      q: p.q || undefined,
      openOnly: p.open === '1',
      sort: p.sort === 'deadline' ? 'deadline' : 'latest',
      page: Number(p.page) || 1,
      limit: Number(p.limit) || 24,
    }),
  );
});

app.get('/api/meta', async (c) => c.json(await queryMeta()));

// 외부 크론(cron-job.org, Vercel Cron)이 30분마다 호출하는 수집 엔드포인트.
// GET 도 허용 (Vercel Cron 은 GET 으로 호출한다).
app.on(['GET', 'POST'], '/api/ingest', async (c) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = c.req.header('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) return c.json({ error: 'unauthorized' }, 401);
  }
  const summary = await ingestAll();
  return c.json({ ok: true, summary });
});
