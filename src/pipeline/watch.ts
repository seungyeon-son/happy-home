/**
 * 스케줄 수집 데몬: 30분 간격으로 ingest 실행 (기동 직후 1회 즉시 실행).
 * 3단계에서 API 서버에 통합하거나, 이대로 별도 프로세스로 돌려도 된다.
 *
 *   npm run watch
 */
import cron from 'node-cron';
import { ingestAll } from './ingest.js';

let running = false;

async function tick() {
  if (running) return; // 이전 수집이 아직 안 끝났으면 이번 회차는 건너뜀
  running = true;
  try {
    await ingestAll();
  } finally {
    running = false;
  }
}

console.log('수집 데몬 시작 — 30분 간격 (*/30 * * * *)');
await tick();
cron.schedule('*/30 * * * *', tick);
