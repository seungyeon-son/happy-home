/**
 * Vercel 서버리스 함수 진입점 — /api/* 전체를 공용 Hono 앱으로 넘긴다.
 * maxDuration 60초: 수집(/api/ingest)이 요청 간격 제한 때문에 수 초 걸리므로 여유 확보.
 */
import { handle } from 'hono/vercel';
import { app } from '../src/server/app.js';

export const config = { maxDuration: 60 };

export default handle(app);
