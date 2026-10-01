/**
 * Vercel 서버리스 함수 진입점 — /api/* 전체를 처리한다.
 *
 * Vercel 의 Node 런타임은 핸들러를 (req, res) 로 호출하므로,
 * Hono 의 fetch 핸들러를 Node 리스너로 변환해서 내보낸다.
 * (hono/vercel 의 handle 은 Web Request/Response 를 주고받는 Next.js 용이라 여기서는 쓰지 않는다)
 *
 * Vercel 에는 영구 디스크가 없으므로 DB 대신 live 저장소를 쓴다.
 * 요청이 오면 LH·SH 를 직접 수집해 메모리에 캐시하고(30분), 응답은 CDN 이 한 번 더 캐시한다.
 * db 저장소(libsql 네이티브 바인딩)는 import 하지 않는다.
 */
import { getRequestListener } from '@hono/node-server';
import { createApp } from '../src/server/create-app.js';
import * as liveStore from '../src/store/live.js';

// 콜드 스타트에서 LH·SH 목록을 직접 가져오므로 기본 10초보다 여유를 둔다.
export const config = { maxDuration: 60 };

export default getRequestListener(createApp(liveStore, 'live').fetch);
