/**
 * 로컬/자체 호스팅용 서버 실행기.
 * 정적 파일(web/dist) 서빙 + (db 모드에서) 30분 간격 수집 크론을 얹는다.
 *
 *   npm run server                  # DB 모드: SQLite 에 누적 저장, 30분마다 수집
 *   DATA_MODE=live npm run server   # 실시간 모드: DB 없이 요청 시 수집 (Vercel 과 동일 동작)
 *   DISABLE_INGEST=1 npm run server # 내장 크론 끄기
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import cron from 'node-cron';
import type { Hono } from 'hono';

const mode = process.env.DATA_MODE === 'live' ? 'live' : 'db';

let app: Hono;
if (mode === 'live') {
  const [{ createApp }, liveStore] = await Promise.all([
    import('./create-app.js'),
    import('../store/live.js'),
  ]);
  app = createApp(liveStore, 'live');
} else {
  app = (await import('./app.js')).app;
}

app.use('*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ root: './web/dist', path: 'index.html' }));

const port = Number(process.env.PORT) || 3000;

if (mode === 'db' && process.env.DISABLE_INGEST !== '1') {
  const { ingestAll } = await import('../pipeline/ingest.js');
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
  console.log(`API 서버 기동 (${mode} 모드): http://localhost:${port}`);
});
