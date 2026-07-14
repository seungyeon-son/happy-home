/** 백엔드 API 클라이언트 — 3단계에서 확정한 계약과 1:1 대응 */

export interface Notice {
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
  daysLeft: number | null;
}

export interface NoticePage {
  items: Notice[];
  total: number;
  page: number;
  limit: number;
}

export interface Meta {
  total: number;
  regions: { value: string; count: number }[];
  categories: { value: string; count: number }[];
  sources: { value: string; count: number }[];
  lastIngestAt: string | null;
}

export interface Filters {
  region: string | null;
  category: string | null;
  /** 내 조건 충족 유형 목록 (설정 시 이 유형들만 조회) */
  categories?: string[];
  q: string;
  openOnly: boolean;
  sort: 'latest' | 'deadline';
}

export async function fetchNotices(filters: Filters, page: number): Promise<NoticePage> {
  const params = new URLSearchParams();
  if (filters.region) params.set('region', filters.region);
  if (filters.category) params.set('category', filters.category);
  if (filters.categories && filters.categories.length > 0)
    params.set('categories', filters.categories.join(','));
  if (filters.q) params.set('q', filters.q);
  if (filters.openOnly) params.set('open', '1');
  params.set('sort', filters.sort);
  params.set('page', String(page));
  params.set('limit', '24');

  const res = await fetch(`/api/notices?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch('/api/meta');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const SOURCE_LABELS: Record<string, string> = {
  lh: 'LH',
  sh: 'SH',
};
