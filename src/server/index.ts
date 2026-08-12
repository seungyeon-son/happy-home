/**
 * 로컬/자체 호스팅용 서버 실행기.
 * 공용 앱(app.ts)에 정적 파일 서빙과 30분 간격 수집 크론을 얹는다.
 * (Vercel 배포에서는 이 파일 대신 api/ 함수 + 정적 호스팅 + 외부 크론을 쓴다)
 *
 *   npm run server            # http://localhost:3000
 *   DISABLE_INGEST=1 ...      # 내장 크론 끄기
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import cron from 'node-cron';
import { app } from './app.js';
import { ingestAll } from '../pipeline/ingest.js';

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
