/**
 * 웹 UI용 자격 판정 모듈.
 * 판정 규칙 자체는 터미널 CLI 와 공유하기 위해 저장소 루트의 src/eligibility.ts 에 있다.
 * 이 파일은 규칙을 재수출하고, 브라우저 전용(localStorage) 헬퍼만 추가한다.
 */
export {
  STATUS_OPTIONS,
  INCOME_OPTIONS,
  DEFAULT_PROFILE,
  verdictForCategory,
  allowedCategories,
} from '../../src/eligibility';
export type { StatusKey, IncomeBand, Profile, Verdict } from '../../src/eligibility';

import type { Profile } from '../../src/eligibility';

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
