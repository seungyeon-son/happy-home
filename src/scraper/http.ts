/**
 * 공공기관 사이트를 예의 있게 긁기 위한 HTTP 유틸.
 * - 브라우저 수준 User-Agent (기본 UA는 WAF에서 차단되는 경우가 많음)
 * - 타임아웃, 지수 백오프 재시도 (5xx / 네트워크 오류 시)
 * - 요청 간 최소 간격 강제 (서버 부하 방지 + 차단 회피)
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 같은 프로세스에서 요청 간 최소 간격. 서버리스 실시간 수집처럼 응답 시간이 중요한
// 환경에서는 SCRAPE_INTERVAL_MS 로 낮춰 쓴다 (CDN 캐시 덕에 호출 빈도 자체가 낮다).
const MIN_INTERVAL_MS = Number(process.env.SCRAPE_INTERVAL_MS) || 1_000;
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

/**
 * 호스트별 요청 큐. 같은 사이트에는 MIN_INTERVAL_MS 이상 간격을 두고 순차 요청하되,
 * 서로 다른 사이트(LH / SH)는 병렬로 진행한다.
 */
const hostQueues = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 해당 호스트의 차례가 될 때까지 기다린다 */
function waitTurn(host: string): Promise<void> {
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const next = prev.then(() => sleep(MIN_INTERVAL_MS));
  hostQueues.set(host, next);
  return prev;
}

export async function fetchHtml(url: string): Promise<string> {
  // 같은 사이트에 대한 요청 간격 강제 (다른 사이트와는 병렬)
  await waitTurn(new URL(url).host);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1_000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      if (res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue; // 서버 오류는 재시도
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`fetch failed after ${MAX_RETRIES + 1} attempts: ${String(lastError)}`);
}
