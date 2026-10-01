/**
 * DB 없이 동작하는 실시간 스냅샷 저장소 (Vercel 등 영구 디스크가 없는 환경용).
 *
 * - 요청이 오면 공고를 직접 수집해 메모리에 캐시하고, TTL 동안 재사용한다.
 * - 동시에 여러 요청이 들어와도 수집은 1회만 수행한다 (in-flight 공유).
 * - 수집에 실패하면 만료된 캐시라도 있으면 그대로 내보낸다 (가용성 우선).
 * - 실제 호출 빈도는 CDN 캐시(s-maxage)가 한 번 더 줄여준다.
 *
 * DB 모드(src/db/queries.ts)와 동일한 함수 시그니처를 제공하므로
 * 서버는 환경에 따라 둘 중 하나를 그대로 바꿔 끼울 수 있다.
 */
import { lhSource } from '../scraper/sources/lh.js';
import { shSource } from '../scraper/sources/sh.js';
import type { Notice } from '../scraper/types.js';
import type { NoticePage, NoticeQuery, NoticeRow } from '../db/types.js';

/** 스냅샷 유효 시간. CDN 캐시와 맞춰 30분. */
const TTL_MS = 30 * 60_000;
/** 소스별로 가져올 목록 페이지 수 (1페이지=88건, 2페이지=123건 수준) */
const MAX_PAGES = Number(process.env.LIVE_MAX_PAGES) || 2;
/** 게시 후 이 시간 안이면 NEW 로 표시 (DB 모드의 first_seen_at 을 대신한다) */
const NEW_WINDOW_HOURS = 48;

interface Snapshot {
  notices: Notice[];
  fetchedAt: string;
}

let cache: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

async function scrape(): Promise<Snapshot> {
  // 서로 다른 사이트이므로 병렬 수집 (요청 간격은 http.ts 가 호스트별로 지킨다).
  // 한 소스가 실패해도 나머지는 살린다.
  const results = await Promise.allSettled(
    [lhSource, shSource].map((s) => s.fetchNotices({ maxPages: MAX_PAGES })),
  );
  const notices: Notice[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') notices.push(...r.value);
    else console.error(`${[lhSource, shSource][i]!.name} 수집 실패:`, r.reason);
  });
  if (notices.length === 0) throw new Error('모든 소스 수집 실패');
  return { notices, fetchedAt: new Date().toISOString() };
}

export async function getSnapshot(): Promise<Snapshot> {
  if (cache && Date.now() - new Date(cache.fetchedAt).getTime() < TTL_MS) return cache;
  if (inFlight) return inFlight;

  inFlight = scrape()
    .then((snap) => {
      cache = snap;
      return snap;
    })
    .catch((err) => {
      if (cache) return cache; // 만료됐더라도 있는 데이터로 서비스 유지
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toRow(n: Notice, index: number): NoticeRow {
  // 실시간 모드에는 "처음 본 시각" 기록이 없으므로 게시일 기준으로 NEW 를 판단한다.
  const postedMs = new Date(`${n.postedAt}T00:00:00Z`).getTime();
  const isNew = Date.now() - postedMs < NEW_WINDOW_HOURS * 3_600_000;
  let daysLeft: number | null = null;
  if (n.closesAt && n.closesAt >= today()) {
    daysLeft = Math.round(
      (new Date(n.closesAt).getTime() - new Date(today()).getTime()) / 86_400_000,
    );
  }
  return {
    id: index + 1,
    source: n.source,
    externalId: n.externalId,
    category: n.category,
    title: n.title,
    region: n.region,
    postedAt: n.postedAt,
    closesAt: n.closesAt,
    status: n.status,
    detailUrl: n.detailUrl,
    firstSeenAt: n.postedAt,
    isNew,
    daysLeft,
  };
}

export async function queryNotices(q: NoticeQuery): Promise<NoticePage> {
  const snap = await getSnapshot();
  const t = today();

  let rows = snap.notices.map(toRow);
  if (q.region) rows = rows.filter((n) => n.region === q.region);
  if (q.category) rows = rows.filter((n) => n.category === q.category);
  if (q.categories && q.categories.length > 0) {
    const set = new Set(q.categories);
    rows = rows.filter((n) => set.has(n.category));
  }
  if (q.q) {
    const needle = q.q.toLowerCase();
    rows = rows.filter((n) => n.title.toLowerCase().includes(needle));
  }
  if (q.openOnly) rows = rows.filter((n) => !n.closesAt || n.closesAt >= t);

  rows.sort((a, b) => {
    if (q.sort === 'deadline') {
      // 마감일 있는 공고를 가까운 순으로, 마감일 없는 공고(SH)는 뒤로
      if ((a.closesAt === null) !== (b.closesAt === null)) return a.closesAt === null ? 1 : -1;
      if (a.closesAt && b.closesAt && a.closesAt !== b.closesAt)
        return a.closesAt < b.closesAt ? -1 : 1;
      return a.postedAt < b.postedAt ? 1 : -1;
    }
    if (a.postedAt !== b.postedAt) return a.postedAt < b.postedAt ? 1 : -1;
    return a.id - b.id;
  });

  const limit = Math.min(Math.max(q.limit ?? 24, 1), 100);
  const page = Math.max(q.page ?? 1, 1);
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    limit,
  };
}

export async function queryMeta() {
  const snap = await getSnapshot();
  const group = (pick: (n: Notice) => string) => {
    const counts = new Map<string, number>();
    for (const n of snap.notices) {
      const key = pick(n);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    total: snap.notices.length,
    regions: group((n) => n.region),
    categories: group((n) => n.category),
    sources: group((n) => n.source),
    lastIngestAt: snap.fetchedAt,
  };
}
