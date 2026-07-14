/**
 * 청약 자격 판정 규칙 엔진.
 *
 * 공고 데이터에는 단지별 상세 자격이 없으므로, 공고 "유형"별 일반 자격 기준
 * (LH/SH 공통으로 통용되는 기준의 단순화 버전)을 규칙으로 두고
 * 사용자가 등록한 조건과 대조해 유형 단위로 충족 여부를 판정한다.
 * → 어디까지나 참고용. 실제 자격은 반드시 공고문 원문으로 확인해야 한다.
 */

export type StatusKey =
  | 'youth' // 만 19~39세 청년
  | 'newlywed' // 신혼부부·예비신혼부부 (혼인 7년 이내)
  | 'student' // 대학생·취업준비생
  | 'senior' // 만 65세 이상 고령자
  | 'singleParent' // 한부모 가족
  | 'recipient'; // 기초생활수급자·차상위계층

/** 도시근로자 가구원수별 월평균소득 대비 구간. 999 = 130% 초과 */
export type IncomeBand = 50 | 70 | 100 | 130 | 999;

export interface Profile {
  statuses: StatusKey[];
  /** 무주택 세대구성원 */
  noHouse: boolean;
  /** 주택청약종합저축 보유 */
  hasAccount: boolean;
  /** 총자산·자동차가액 기준 충족 */
  assetOk: boolean;
  incomeBand: IncomeBand;
}

export type Verdict = 'eligible' | 'ineligible' | 'unknown';

export const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: 'youth', label: '청년 (만 19~39세)' },
  { key: 'newlywed', label: '신혼부부·예비 (혼인 7년 이내)' },
  { key: 'student', label: '대학생·취업준비생' },
  { key: 'senior', label: '고령자 (만 65세 이상)' },
  { key: 'singleParent', label: '한부모 가족' },
  { key: 'recipient', label: '수급자·차상위계층' },
];

export const INCOME_OPTIONS: { value: IncomeBand; label: string }[] = [
  { value: 50, label: '50% 이하' },
  { value: 70, label: '70% 이하' },
  { value: 100, label: '100% 이하' },
  { value: 130, label: '130% 이하' },
  { value: 999, label: '130% 초과' },
];

export const DEFAULT_PROFILE: Profile = {
  statuses: [],
  noHouse: false,
  hasAccount: false,
  assetOk: false,
  incomeBand: 100,
};

/** 공고 유형명 → 자격 판정. 규칙에 없는 유형은 unknown (숨기지 않음). */
export function verdictForCategory(category: string, p: Profile): Verdict {
  const has = (...keys: StatusKey[]) => keys.some((k) => p.statuses.includes(k));
  const income = (limit: number) => p.incomeBand <= limit;
  const ok = (cond: boolean): Verdict => (cond ? 'eligible' : 'ineligible');

  // 구체적인 유형을 먼저, 포괄 유형을 나중에 매칭한다.
  if (category.includes('행복주택'))
    return ok(
      p.noHouse &&
        p.assetOk &&
        income(100) &&
        has('youth', 'newlywed', 'student', 'senior', 'recipient'),
    );
  if (category.includes('영구임대'))
    return ok(p.noHouse && income(50) && has('recipient', 'singleParent', 'senior'));
  if (category.includes('국민임대')) return ok(p.noHouse && p.assetOk && income(70));
  if (category.includes('통합공공임대')) return ok(p.noHouse && p.assetOk && income(130));
  if (category.includes('매입임대') || category.includes('전세임대'))
    return ok(p.noHouse && (income(70) || (has('youth', 'newlywed') && income(100))));
  if (category.includes('공공분양') || category.includes('신혼희망'))
    return ok(p.noHouse && p.hasAccount && p.assetOk && income(130));
  if (category.includes('공공임대'))
    return ok(p.noHouse && p.hasAccount && p.assetOk && income(130));
  if (category.includes('분양')) return ok(p.hasAccount); // 일반분양·잔여세대: 통장 요건 위주
  if (category.includes('임대')) return ok(p.noHouse && income(100)); // SH 주택임대 등 포괄

  return 'unknown';
}

/** 전체 유형 목록 중 '불충족'이 아닌 유형만 반환 (unknown 은 숨기지 않는다) */
export function allowedCategories(all: string[], p: Profile): string[] {
  return all.filter((c) => verdictForCategory(c, p) !== 'ineligible');
}

const STORAGE_KEY = 'hh-profile-v1';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!Array.isArray(p.statuses) || typeof p.noHouse !== 'boolean') return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}
