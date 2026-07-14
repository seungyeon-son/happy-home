import { getDb } from './index.js';

/** API 응답용 공고 (camelCase). isNew 는 first_seen_at 기준 48시간 이내 여부. */
export interface NoticeRow {
  id: number;
  source: string;
  externalId: string;
  category: string;
  title: string;
  region: string;
  postedAt: string;
  closesAt: string | null;
  status: string | null;
  detailUrl: string;
  firstSeenAt: string;
  isNew: boolean;
  /** 마감까지 남은 일수 (오늘 마감=0, 지났거나 마감일 없으면 null) */
  daysLeft: number | null;
}

export interface NoticeQuery {
  region?: string | undefined;
  category?: string | undefined;
  /** 복수 유형 필터 (내 조건 충족 유형 목록). category 와 동시 사용 시 둘 다 적용(AND). */
  categories?: string[] | undefined;
  source?: string | undefined;
  q?: string | undefined;
  /** true 면 마감 안 지난 공고만 (마감일 없는 공고 포함) */
  openOnly?: boolean | undefined;
  sort?: 'latest' | 'deadline' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface NoticePage {
  items: NoticeRow[];
  total: number;
  page: number;
  limit: number;
}

const NEW_WINDOW_HOURS = 48;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(r: any): NoticeRow {
  const isNew =
    Date.now() - new Date(r.first_seen_at).getTime() < NEW_WINDOW_HOURS * 3_600_000;
  let daysLeft: number | null = null;
  if (r.closes_at && r.closes_at >= today()) {
    daysLeft = Math.round(
      (new Date(r.closes_at).getTime() - new Date(today()).getTime()) / 86_400_000,
    );
  }
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    category: r.category,
    title: r.title,
    region: r.region,
    postedAt: r.posted_at,
    closesAt: r.closes_at,
    status: r.status,
    detailUrl: r.detail_url,
    firstSeenAt: r.first_seen_at,
    isNew,
    daysLeft,
  };
}

export function queryNotices(q: NoticeQuery): NoticePage {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (q.region) {
    where.push('region = @region');
    params.region = q.region;
  }
  if (q.category) {
    where.push('category = @category');
    params.category = q.category;
  }
  if (q.categories && q.categories.length > 0) {
    const keys = q.categories.map((_, i) => `@cat${i}`);
    where.push(`category IN (${keys.join(', ')})`);
    q.categories.forEach((c, i) => {
      params[`cat${i}`] = c;
    });
  }
  if (q.source) {
    where.push('source = @source');
    params.source = q.source;
  }
  if (q.q) {
    where.push('title LIKE @q');
    params.q = `%${q.q}%`;
  }
  if (q.openOnly) {
    where.push('(closes_at IS NULL OR closes_at >= @today)');
    params.today = today();
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // 마감임박순: 마감일 있는 공고를 가까운 순으로, 마감일 없는 공고(SH)는 뒤로
  const orderSql =
    q.sort === 'deadline'
      ? 'ORDER BY (closes_at IS NULL) ASC, closes_at ASC, posted_at DESC'
      : 'ORDER BY posted_at DESC, id DESC';

  const limit = Math.min(Math.max(q.limit ?? 24, 1), 100);
  const page = Math.max(q.page ?? 1, 1);

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM notices ${whereSql}`).get(params) as { c: number }
  ).c;
  const rows = db
    .prepare(`SELECT * FROM notices ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset: (page - 1) * limit });

  return { items: rows.map(toRow), total, page, limit };
}

/** 필터 UI 구성용 메타데이터 */
export function queryMeta() {
  const db = getDb();
  const group = (col: string) =>
    db
      .prepare(`SELECT ${col} AS value, COUNT(*) AS count FROM notices GROUP BY ${col} ORDER BY count DESC`)
      .all() as { value: string; count: number }[];

  const lastIngestAt =
    (db.prepare('SELECT MAX(last_seen_at) AS m FROM notices').get() as { m: string | null }).m ??
    null;

  return {
    total: (db.prepare('SELECT COUNT(*) AS c FROM notices').get() as { c: number }).c,
    regions: group('region'),
    categories: group('category'),
    sources: group('source'),
    lastIngestAt,
  };
}
