/**
 * 공공기관 사이트를 예의 있게 긁기 위한 HTTP 유틸.
 * - 브라우저 수준 User-Agent (기본 UA는 WAF에서 차단되는 경우가 많음)
 * - 타임아웃, 지수 백오프 재시도 (5xx / 네트워크 오류 시)
 * - 요청 간 최소 간격 강제 (서버 부하 방지 + 차단 회피)
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MIN_INTERVAL_MS = 1_000; // 같은 프로세스에서 요청 간 최소 1초
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchHtml(url: string): Promise<string> {
  // 요청 간격 강제
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1_000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
    lastRequestAt = Date.now();
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
