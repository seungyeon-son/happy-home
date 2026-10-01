/**
 * 데이터 저장소를 주입받아 API 앱을 만드는 팩토리.
 *
 * 저장소를 주입식으로 둔 이유: Vercel 함수(api/)는 live 저장소만 import 해야 한다.
 * db 저장소를 거치면 네이티브 바인딩(libsql)이 번들에 끌려 들어오기 때문이다.
 *
 *   GET /api/notices  — 공고 목록 (region, category, categories, q, open, sort, page, limit)
 *   GET /api/meta     — 필터 UI 용 메타데이터
 *   GET /api/health   — 헬스체크 (현재 데이터 모드 표시)
 */
import { Hono } from 'hono';
import type { NoticePage, NoticeQuery } from '../db/types.js';

export interface NoticeStore {
  queryNotices(q: NoticeQuery): Promise<NoticePage>;
  queryMeta(): Promise<{
    total: number;
    regions: { value: string; count: number }[];
    categories: { value: string; count: number }[];
    sources: { value: string; count: number }[];
    lastIngestAt: string | null;
  }>;
}

/** live 모드 응답은 CDN 에서 30분 캐시하고, 그 뒤 1시간은 갱신하는 동안 기존 응답을 내보낸다. */
const CDN_CACHE = 'public, s-maxage=1800, stale-while-revalidate=3600';

export function createApp(store: NoticeStore, mode: 'live' | 'db'): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, mode }));

  app.get('/api/notices', async (c) => {
    const p = c.req.query();
    const result = await store.queryNotices({
      region: p.region || undefined,
      category: p.category || undefined,
      categories: p.categories ? p.categories.split(',').filter(Boolean) : undefined,
      q: p.q || undefined,
      openOnly: p.open === '1',
      sort: p.sort === 'deadline' ? 'deadline' : 'latest',
      page: Number(p.page) || 1,
      limit: Number(p.limit) || 24,
    });
    if (mode === 'live') c.header('Cache-Control', CDN_CACHE);
    return c.json(result);
  });

  app.get('/api/meta', async (c) => {
    const result = await store.queryMeta();
    if (mode === 'live') c.header('Cache-Control', CDN_CACHE);
    return c.json(result);
  });

  return app;
}
