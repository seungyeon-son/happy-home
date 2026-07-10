/**
 * 모든 소스(LH, SH, ...)가 공통으로 산출하는 정규화된 공고 모델.
 * DB 스키마(2단계)와 프론트엔드 카드 UI(4단계)가 모두 이 모델을 기준으로 한다.
 */
export interface Notice {
  /** 소스 식별자: 'lh' | 'sh' */
  source: string;
  /** 소스 내에서 공고를 유일하게 식별하는 ID (LH panId, SH 게시글 seq 등). 중복 저장 방지 키. */
  externalId: string;
  /** 공고 유형: 행복주택, 국민임대, 공공분양 등 소스가 제공하는 원문 그대로 */
  category: string;
  title: string;
  /** 지역 (예: 서울특별시, 경기도). SH는 항상 서울. */
  region: string;
  /** 게시일 ISO 날짜 (YYYY-MM-DD) */
  postedAt: string;
  /** 마감일 ISO 날짜. 소스가 제공하지 않으면 null. */
  closesAt: string | null;
  /** 공고 상태 원문 (공고중, 접수중, 마감 등). 없으면 null. */
  status: string | null;
  /** 원문 공고 상세 페이지 URL */
  detailUrl: string;
}

/** 소스 어댑터 인터페이스. 새 기관 추가 = 이 인터페이스 구현체 하나 추가. */
export interface NoticeSource {
  readonly id: string;
  readonly name: string;
  /** 최신 공고부터 maxPages 페이지까지 수집해 정규화된 Notice 배열을 반환 */
  fetchNotices(opts?: { maxPages?: number }): Promise<Notice[]>;
}
