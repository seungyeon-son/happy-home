/** API 응답용 공고 (camelCase). 저장소 구현(db/live)이 공통으로 사용한다. */
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
  /** 최근 등장한 공고 여부 (db 모드: 최초 수집 48시간 내 / live 모드: 게시 48시간 내) */
  isNew: boolean;
  /** 마감까지 남은 일수 (오늘 마감=0, 지났거나 마감일 없으면 null) */
  daysLeft: number | null;
}

export interface NoticeQuery {
  region?: string | undefined;
  category?: string | undefined;
  /** 복수 유형 필터 (내 조건 충족 유형 목록). category 와 동시 사용 시 둘 다 적용(AND). */
  categories?: string[] | undefined;
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
