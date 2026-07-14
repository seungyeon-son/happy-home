import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMeta, fetchNotices } from './api';
import type { Filters, Meta, Notice } from './api';
import { NoticeCard } from './NoticeCard';
import { ProfileModal } from './ProfileModal';
import { allowedCategories, clearProfile, loadProfile, saveProfile } from './eligibility';
import type { Profile } from './eligibility';

const MATCH_ONLY_KEY = 'hh-match-only';

const INITIAL_FILTERS: Filters = {
  region: null,
  category: null,
  q: '',
  openOnly: true,
  sort: 'deadline',
};

/** 유형 필터에 노출할 상위 개수 (그 외는 '전체'로 흡수) */
const MAX_CATEGORY_CHIPS = 8;

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [matchOnly, setMatchOnly] = useState(
    () => localStorage.getItem(MATCH_ONLY_KEY) === '1',
  );
  const [modalOpen, setModalOpen] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    fetchMeta().then(setMeta).catch(() => {});
  }, []);

  const allCategoryNames = useMemo(
    () => (meta?.categories ?? []).map((c) => c.value),
    [meta],
  );

  /**
   * 실제 요청에 쓸 필터. "내 조건 충족" 이 켜져 있으면 프로필로 판정한
   * 충족 유형 목록을 categories 파라미터로 변환한다.
   * null = 선택한 유형이 내 조건과 상충해 결과가 있을 수 없는 경우.
   */
  const effectiveFilters = useMemo<Filters | null>(() => {
    if (!matchOnly || !profile || allCategoryNames.length === 0) return filters;
    const allowed = allowedCategories(allCategoryNames, profile);
    if (filters.category) {
      return allowed.includes(filters.category) ? filters : null;
    }
    return { ...filters, categories: allowed };
  }, [filters, matchOnly, profile, allCategoryNames]);

  // 필터 변경 → 1페이지부터 다시. 검색어는 300ms 디바운스.
  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    if (effectiveFilters === null) {
      setNotices([]);
      setTotal(0);
      setPage(1);
      setLoading(false);
      return;
    }
    const timer = setTimeout(
      () => {
        fetchNotices(effectiveFilters, 1)
          .then((r) => {
            if (seq !== requestSeq.current) return; // 늦게 도착한 응답 무시
            setNotices(r.items);
            setTotal(r.total);
            setPage(1);
            setLoading(false);
          })
          .catch(() => {
            if (seq !== requestSeq.current) return;
            setError(true);
            setLoading(false);
          });
      },
      effectiveFilters.q ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [effectiveFilters]);

  const loadMore = () => {
    if (effectiveFilters === null) return;
    const next = page + 1;
    fetchNotices(effectiveFilters, next).then((r) => {
      setNotices((prev) => [...prev, ...r.items]);
      setPage(next);
    });
  };

  const applyMatchOnly = (on: boolean) => {
    setMatchOnly(on);
    localStorage.setItem(MATCH_ONLY_KEY, on ? '1' : '0');
  };

  const handleSaveProfile = (p: Profile) => {
    saveProfile(p);
    setProfile(p);
    applyMatchOnly(true); // 등록 즉시 내 조건 필터 적용
    setModalOpen(false);
  };

  const handleResetProfile = () => {
    clearProfile();
    setProfile(null);
    applyMatchOnly(false);
    setModalOpen(false);
  };

  const categories = useMemo(
    () => (meta?.categories ?? []).slice(0, MAX_CATEGORY_CHIPS),
    [meta],
  );

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="mx-auto max-w-[1200px] px-6 md:px-10">
      {/* ── 상단 바 ── */}
      <header className="flex items-baseline justify-between pt-8">
        <span className="text-sm font-bold tracking-tight">
          happy<span className="text-accent">—</span>home
        </span>
        {meta?.lastIngestAt && (
          <span className="text-[11px] tracking-wide text-ink-soft tabular-nums">
            {new Date(meta.lastIngestAt).toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            수집
          </span>
        )}
      </header>

      {/* ── 히어로: 비대칭 타이포그래피 ── */}
      <section className="grid grid-cols-12 items-end pt-20 pb-16 md:pt-28 md:pb-24">
        <h1 className="col-span-12 md:col-span-8 text-[13vw] leading-[0.95] font-extrabold tracking-[-0.04em] md:text-8xl break-keep">
          지금,
          <br />
          열린 집<span className="text-accent">.</span>
        </h1>
        <div className="col-span-12 mt-10 md:col-span-4 md:mt-0 md:justify-self-end md:text-right">
          <p className="text-[26px] font-extrabold tabular-nums leading-none tracking-tight">
            {loading && notices.length === 0 ? '—' : total}
            <span className="ml-1 text-sm font-medium text-ink-soft">건</span>
          </p>
          <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-ink-soft md:ml-auto">
            LH 청약플러스와 SH 서울주택도시공사의 임대·분양 공고를 30분마다 모아 봅니다.
          </p>
        </div>
      </section>

      {/* ── 필터: 텍스트 기반, 최소한의 선 ── */}
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterChip active={!filters.category} onClick={() => set({ category: null })}>
            전체
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.value}
              active={filters.category === c.value}
              onClick={() => set({ category: filters.category === c.value ? null : c.value })}
            >
              {c.value}
            </FilterChip>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-5">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={`text-[13px] transition-colors ${
              profile
                ? 'font-bold text-ink underline decoration-accent decoration-2 underline-offset-[6px]'
                : 'font-medium text-ink-soft hover:text-ink'
            }`}
          >
            내 조건
          </button>

          {profile && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft select-none">
              <input
                type="checkbox"
                checked={matchOnly}
                onChange={(e) => applyMatchOnly(e.target.checked)}
                className="accent-accent"
              />
              충족만
            </label>
          )}

          <select
            value={filters.region ?? ''}
            onChange={(e) => set({ region: e.target.value || null })}
            className="cursor-pointer appearance-none bg-transparent text-[13px] font-medium outline-none"
            aria-label="지역 선택"
          >
            <option value="">모든 지역</option>
            {(meta?.regions ?? []).map((r) => (
              <option key={r.value} value={r.value}>
                {r.value} ({r.count})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => set({ sort: filters.sort === 'deadline' ? 'latest' : 'deadline' })}
            className="text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <span className={filters.sort === 'deadline' ? 'text-ink font-semibold' : ''}>
              마감임박
            </span>
            <span className="mx-1.5 text-line">/</span>
            <span className={filters.sort === 'latest' ? 'text-ink font-semibold' : ''}>최신</span>
          </button>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft select-none">
            <input
              type="checkbox"
              checked={filters.openOnly}
              onChange={(e) => set({ openOnly: e.target.checked })}
              className="accent-accent"
            />
            진행중만
          </label>

          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="검색"
            className="w-24 border-b border-line bg-transparent pb-1 text-[13px] outline-none transition-all placeholder:text-ink-soft/60 focus:w-40 focus:border-ink"
            aria-label="공고 제목 검색"
          />
        </div>
      </nav>

      {/* ── 공고 그리드: 첫 카드만 넓게(비대칭) ── */}
      <main className="grid grid-cols-12 gap-x-10 gap-y-2 pt-10 pb-8">
        {error && (
          <p className="col-span-12 py-24 text-center text-sm text-ink-soft">
            공고를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
          </p>
        )}
        {!error && !loading && notices.length === 0 && (
          <p className="col-span-12 py-24 text-center text-sm text-ink-soft">
            조건에 맞는 공고가 없습니다.
            {matchOnly && profile && (
              <>
                <br />
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-2 font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4"
                >
                  내 조건 다시 설정하기
                </button>
              </>
            )}
          </p>
        )}
        {notices.map((n, i) => (
          <NoticeCard key={`${n.source}-${n.externalId}`} notice={n} featured={i === 0} />
        ))}
      </main>

      {notices.length < total && (
        <div className="pb-16 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="border border-ink px-8 py-3 text-[13px] font-semibold tracking-widest transition-colors hover:bg-ink hover:text-paper"
          >
            더 보기 ({notices.length}/{total})
          </button>
        </div>
      )}

      <footer className="border-t border-line py-8 text-[11px] leading-relaxed text-ink-soft">
        공고 원문과 신청은 각 기관 사이트에서 진행됩니다. 카드를 누르면 원문으로 이동합니다.
        <br />
        내 조건 필터는 유형별 일반 자격 기준에 따른 참고용이며, 실제 자격은 공고문을 확인하세요.
        <br />
        출처: LH 청약플러스(apply.lh.or.kr) · SH 서울주택도시공사(i-sh.co.kr)
      </footer>

      <ProfileModal
        open={modalOpen}
        initial={profile}
        allCategories={allCategoryNames}
        onSave={handleSaveProfile}
        onReset={handleResetProfile}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[13px] transition-colors ${
        active
          ? 'font-bold text-ink underline decoration-accent decoration-2 underline-offset-[6px]'
          : 'font-medium text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
