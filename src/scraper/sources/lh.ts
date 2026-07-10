import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';
import type { Notice, NoticeSource } from '../types.js';

/**
 * LH 청약플러스 (apply.lh.or.kr) 공고문 어댑터.
 *
 * 실측 결과(2026-07 기준):
 * - 목록은 selectWrtancList.do 가 서버 렌더링한 HTML <tbody> 에 그대로 담겨 온다.
 *   → 헤드리스 브라우저 불필요, GET + HTML 파싱으로 충분.
 * - 각 행의 제목 링크(a.wrtancInfoBtn)에 상세 페이지를 여는 데 필요한
 *   4개 키가 data 속성으로 붙어 있다:
 *     data-id1=panId, data-id2=ccrCnntSysDsCd, data-id3=uppAisTpCd, data-id4=aisTpCd
 * - 상세는 위 4개 키를 쿼리스트링으로 넘기는 GET 으로 접근 가능 (200 확인).
 * - mi=1026 임대주택 / mi=1027 분양주택 (테이블 구조 동일).
 */

const BASE = 'https://apply.lh.or.kr';
const LIST_PATH = '/lhapply/apply/wt/wrtanc/selectWrtancList.do';
const DETAIL_PATH = '/lhapply/apply/wt/wrtanc/selectWrtancInfo.do';

const MENUS = [
  { mi: '1026', label: '임대주택' },
  { mi: '1027', label: '분양주택' },
] as const;

/** "2026.07.10" → "2026-07-10", 그 외 형식은 null */
function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseListPage(html: string, mi: string): Notice[] {
  const $ = cheerio.load(html);
  const notices: Notice[] = [];

  $('tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const $link = $tr.find('a.wrtancInfoBtn');
    if ($link.length === 0) return; // 공고 행이 아님 (빈 목록 안내 등)

    const panId = $link.attr('data-id1');
    if (!panId) return;

    const cells = $tr.find('td');
    // 열 순서: 번호 | 유형 | 제목 | 지역 | 첨부 | 게시일 | 마감일 | 상태 | 조회수
    const category = cells.eq(1).text().trim();
    const region = cells.eq(3).text().trim();
    const postedAt = parseDate(cells.eq(5).text());
    const closesAt = parseDate(cells.eq(6).text());
    const status = cells.eq(7).text().trim() || null;

    // 제목 셀 안의 "1일전"/"NEW" 뱃지(em)를 제외한 순수 제목
    const $titleSpan = $link.find('span').clone();
    $titleSpan.find('em').remove();
    const title = $titleSpan.text().trim();

    const detail = new URL(DETAIL_PATH, BASE);
    detail.searchParams.set('mi', mi);
    detail.searchParams.set('panId', panId);
    detail.searchParams.set('ccrCnntSysDsCd', $link.attr('data-id2') ?? '');
    detail.searchParams.set('uppAisTpCd', $link.attr('data-id3') ?? '');
    detail.searchParams.set('aisTpCd', $link.attr('data-id4') ?? '');

    if (!title || !postedAt) return; // 필수 필드 없는 행은 버림

    notices.push({
      source: 'lh',
      externalId: panId,
      category,
      title,
      region,
      postedAt,
      closesAt,
      status,
      detailUrl: detail.toString(),
    });
  });

  return notices;
}

export const lhSource: NoticeSource = {
  id: 'lh',
  name: 'LH 청약플러스',

  async fetchNotices({ maxPages = 1 } = {}): Promise<Notice[]> {
    const all: Notice[] = [];
    for (const menu of MENUS) {
      for (let page = 1; page <= maxPages; page++) {
        const url = new URL(LIST_PATH, BASE);
        url.searchParams.set('mi', menu.mi);
        url.searchParams.set('currPage', String(page));
        const html = await fetchHtml(url.toString());
        const notices = parseListPage(html, menu.mi);
        all.push(...notices);
        if (notices.length === 0) break; // 마지막 페이지 도달
      }
    }
    // 같은 공고가 임대/분양 양쪽에 걸리는 경우 대비 프로세스 내 중복 제거
    const seen = new Set<string>();
    return all.filter((n) => !seen.has(n.externalId) && seen.add(n.externalId));
  },
};
