import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';
import type { Notice, NoticeSource } from '../types.js';

/**
 * SH 서울주택도시공사 (i-sh.co.kr) 공고 게시판 어댑터.
 *
 * 실측 결과(2026-07 기준):
 * - 게시판은 서버 렌더링. 목록 GET: list.do?multi_itm_seq={탭}&page={n} (200 확인)
 * - 상세는 원래 폼 POST(view.do + seq)지만 GET view.do?seq={n} 도 200 확인.
 * - 행 컬럼: 번호 | 제목 | 담당부서 | 등록일 | 조회수. 유형·마감일 컬럼이 없어
 *   유형은 탭(multi_itm_seq)으로 구분하고 마감일/상태는 null 로 둔다. 지역은 항상 서울.
 * - 제목 링크: onclick="getDetailView('306718')" — 게시글 seq 가 externalId.
 */

const BASE = 'https://www.i-sh.co.kr';

const TABS = [
  { seq: '2', program: 'S1T294C297', board: 'm_247', label: '주택임대' },
  { seq: '1', program: 'S1T294C296', board: 'm_244', label: '주택분양' },
] as const;

function listUrl(tab: (typeof TABS)[number], page: number): string {
  return `${BASE}/main/lay2/program/${tab.program}/www/brd/${tab.board}/list.do?multi_itm_seq=${tab.seq}&page=${page}`;
}

function detailUrl(tab: (typeof TABS)[number], seq: string): string {
  return `${BASE}/main/lay2/program/${tab.program}/www/brd/${tab.board}/view.do?seq=${seq}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseListPage(html: string, tab: (typeof TABS)[number]): Notice[] {
  const $ = cheerio.load(html);
  const notices: Notice[] = [];

  $('tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const $link = $tr.find('a[onclick*="getDetailView"]');
    if ($link.length === 0) return;

    const seq = ($link.attr('onclick') ?? '').match(/getDetailView\('(\d+)'\)/)?.[1];
    if (!seq) return;

    const title = $link.text().trim().replace(/\s+/g, ' ');
    // 등록일: 셀 위치가 게시판 설정에 따라 밀릴 수 있어 날짜 형식으로 탐색
    const postedAt = $tr
      .find('td')
      .toArray()
      .map((td) => $(td).text().trim())
      .find((t) => DATE_RE.test(t));

    if (!title || !postedAt) return;

    notices.push({
      source: 'sh',
      externalId: seq,
      category: tab.label,
      title,
      region: '서울특별시',
      postedAt,
      closesAt: null,
      status: null,
      detailUrl: detailUrl(tab, seq),
    });
  });

  return notices;
}

export const shSource: NoticeSource = {
  id: 'sh',
  name: 'SH 서울주택도시공사',

  async fetchNotices({ maxPages = 1 } = {}): Promise<Notice[]> {
    const all: Notice[] = [];
    for (const tab of TABS) {
      for (let page = 1; page <= maxPages; page++) {
        const html = await fetchHtml(listUrl(tab, page));
        const notices = parseListPage(html, tab);
        all.push(...notices);
        if (notices.length === 0) break;
      }
    }
    const seen = new Set<string>();
    return all.filter((n) => !seen.has(n.externalId) && seen.add(n.externalId));
  },
};
