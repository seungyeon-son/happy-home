import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PROFILE,
  INCOME_OPTIONS,
  STATUS_OPTIONS,
  verdictForCategory,
} from './eligibility';
import type { Profile, StatusKey } from './eligibility';

interface Props {
  open: boolean;
  initial: Profile | null;
  /** 충족 유형 미리보기 계산용 전체 유형 목록 */
  allCategories: string[];
  onSave: (p: Profile) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ProfileModal({ open, initial, allCategories, onSave, onReset, onClose }: Props) {
  const [draft, setDraft] = useState<Profile>(initial ?? DEFAULT_PROFILE);
  const panelRef = useRef<HTMLDivElement>(null);

  // 열릴 때마다 저장된 조건으로 초기화 + 포커스 이동 + 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? DEFAULT_PROFILE);
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, initial, onClose]);

  const toggleStatus = (key: StatusKey) =>
    setDraft((d) => ({
      ...d,
      statuses: d.statuses.includes(key)
        ? d.statuses.filter((s) => s !== key)
        : [...d.statuses, key],
    }));

  const preview = useMemo(() => {
    const verdicts = allCategories.map((c) => verdictForCategory(c, draft));
    return {
      eligible: verdicts.filter((v) => v === 'eligible').length,
      total: allCategories.length,
    };
  }, [allCategories, draft]);

  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
    >
      {/* 오버레이: 진입 200ms ease-out / 퇴장 150ms ease-in */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/30 motion-reduce:transition-none ${
          open
            ? 'opacity-100 transition-opacity duration-200 ease-out'
            : 'opacity-0 transition-opacity duration-150 ease-in'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="내 조건 설정"
        tabIndex={-1}
        className={`absolute inset-x-4 top-[6vh] mx-auto max-h-[86vh] max-w-[560px] overflow-y-auto border border-ink bg-paper p-7 outline-none md:p-10 motion-reduce:transition-none ${
          open
            ? 'translate-y-0 scale-100 opacity-100 transition-[opacity,transform] duration-200 ease-out'
            : 'translate-y-3 scale-[0.98] opacity-0 transition-[opacity,transform] duration-150 ease-in'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              내 조건<span className="text-accent">.</span>
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              해당하는 항목을 체크하면 자격이 되는 공고 유형만 골라 보여드립니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 -mt-1 p-2 text-ink-soft transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        {/* 기본 요건 */}
        <fieldset className="mt-8 border-t border-ink pt-5">
          <legend className="sr-only">기본 요건</legend>
          <p className="text-[13px] font-semibold">기본 요건</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {(
              [
                ['noHouse', '무주택 세대구성원이에요'],
                ['hasAccount', '청약통장(주택청약종합저축)이 있어요'],
                ['assetOk', '자산 기준(총자산·자동차가액)을 충족해요'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 text-[14px] select-none"
              >
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-accent"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* 해당 사항 */}
        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="sr-only">해당 사항</legend>
          <p className="text-[13px] font-semibold">
            해당 사항 <span className="font-normal text-ink-soft">(모두 선택)</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const active = draft.statuses.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(s.key)}
                  className={`border px-3 py-2 text-[13px] transition-colors active:scale-[0.98] motion-reduce:transition-none ${
                    active
                      ? 'border-ink bg-ink font-semibold text-paper'
                      : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 소득 구간 */}
        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="sr-only">소득 구간</legend>
          <p className="text-[13px] font-semibold">
            월평균 소득{' '}
            <span className="font-normal text-ink-soft">(도시근로자 가구원수별 평균 대비)</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INCOME_OPTIONS.map((o) => {
              const active = draft.incomeBand === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft((d) => ({ ...d, incomeBand: o.value }))}
                  className={`border px-3 py-2 text-[13px] tabular-nums transition-colors active:scale-[0.98] motion-reduce:transition-none ${
                    active
                      ? 'border-ink bg-ink font-semibold text-paper'
                      : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 미리보기 + 액션 */}
        <div className="mt-8 flex items-center justify-between border-t border-ink pt-5">
          <p className="text-[13px] text-ink-soft">
            지금 조건이면{' '}
            <strong className="font-bold text-accent tabular-nums">{preview.eligible}</strong>
            <span className="tabular-nums">/{preview.total}</span>개 유형 충족
          </p>
          <div className="flex items-center gap-4">
            {initial && (
              <button
                type="button"
                onClick={onReset}
                className="text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="bg-ink px-7 py-3 text-[13px] font-semibold tracking-widest text-paper transition-[background-color,transform] hover:bg-accent active:scale-[0.98] motion-reduce:transition-none"
            >
              등록
            </button>
          </div>
        </div>

        <p className="mt-5 text-[11px] leading-relaxed text-ink-soft">
          유형별 일반 자격 기준을 단순화한 참고용 판정입니다. 단지·공고마다 세부 기준이 다르므로
          실제 자격은 반드시 공고문 원문에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
