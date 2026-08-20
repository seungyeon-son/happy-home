/**
 * 내 조건에 맞는 공고만 터미널에 출력한다. (서버 없이 단독 실행)
 *
 *   npm run my                       # 저장된 조건으로 조회 (my-profile.json)
 *   npm run my -- --setup            # 조건을 플래그로 지정하고 저장
 *   npm run my -- --days=7           # 최근 7일 내 게시된 공고만
 *   npm run my -- --region=서울특별시  # 지역 한정
 *
 * 조건 플래그(--setup 과 함께 사용):
 *   --nohouse --account --asset --income=100
 *   --youth --newlywed --student --senior --single-parent --recipient
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ingestAll } from './ingest.js';
import { queryNotices, queryMeta } from '../db/queries.js';
import { DEFAULT_PROFILE, allowedCategories, verdictForCategory } from '../eligibility.js';
import type { IncomeBand, Profile, StatusKey } from '../eligibility.js';

const PROFILE_PATH = path.join(process.cwd(), 'my-profile.json');

const STATUS_FLAGS: Record<string, StatusKey> = {
  '--youth': 'youth',
  '--newlywed': 'newlywed',
  '--student': 'student',
  '--senior': 'senior',
  '--single-parent': 'singleParent',
  '--recipient': 'recipient',
};

function parseProfileFlags(args: string[]): Profile {
  const p: Profile = { ...DEFAULT_PROFILE, statuses: [] };
  for (const arg of args) {
    if (STATUS_FLAGS[arg]) p.statuses.push(STATUS_FLAGS[arg]!);
    else if (arg === '--nohouse') p.noHouse = true;
    else if (arg === '--account') p.hasAccount = true;
    else if (arg === '--asset') p.assetOk = true;
    else if (arg.startsWith('--income=')) p.incomeBand = Number(arg.slice(9)) as IncomeBand;
  }
  return p;
}

function loadProfile(): Profile | null {
  if (!existsSync(PROFILE_PATH)) return null;
  return JSON.parse(readFileSync(PROFILE_PATH, 'utf8')) as Profile;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

// 1) 조건 준비
let profile: Profile | null;
if (args.includes('--setup')) {
  profile = parseProfileFlags(args);
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  console.log(`조건을 저장했습니다 → ${PROFILE_PATH}\n`);
} else {
  profile = loadProfile();
  if (!profile) {
    console.log(
      '저장된 조건이 없습니다. 먼저 조건을 등록하세요. 예시:\n\n' +
        '  npm run my -- --setup --nohouse --asset --youth --income=100\n\n' +
        '플래그: --nohouse(무주택) --account(청약통장) --asset(자산기준)\n' +
        '        --youth --newlywed --student --senior --single-parent --recipient\n' +
        '        --income=50|70|100|130|999\n',
    );
    process.exit(0);
  }
}

// 2) 최신 공고 수집 (--no-fetch 로 생략 가능)
if (!args.includes('--no-fetch')) {
  console.log('최신 공고를 가져오는 중...\n');
  await ingestAll();
  console.log('');
}

// 3) 내 조건에 맞는 유형만 조회
const meta = await queryMeta();
const allowed = allowedCategories(
  meta.categories.map((c) => c.value),
  profile,
);
const days = Number(flag('days')) || 0;
const region = flag('region');

const { items, total } = await queryNotices({
  categories: allowed,
  region,
  openOnly: true,
  sort: 'deadline',
  limit: 100,
});

const since = days
  ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  : null;
const rows = since ? items.filter((n) => n.postedAt >= since) : items;

// 4) 출력
const label = [
  region ?? '전국',
  days ? `최근 ${days}일 게시` : '진행중 전체',
].join(' · ');
console.log(`■ 내 조건 충족 공고 — ${label}`);
console.log(`  충족 유형: ${allowed.join(', ')}`);
console.log(`  ${rows.length}건${since ? ` (진행중 ${total}건 중)` : ''}\n`);

for (const n of rows) {
  const dday = n.daysLeft === null ? '     ' : `D-${String(n.daysLeft).padStart(2, '0')}`;
  const isNew = n.isNew ? ' [NEW]' : '';
  console.log(`  ${dday}  [${n.category}] ${n.title}${isNew}`);
  console.log(`         ${n.region} · ${n.postedAt} 게시${n.closesAt ? ` → ${n.closesAt} 마감` : ''}`);
  console.log(`         ${n.detailUrl}\n`);
}

if (rows.length === 0) {
  console.log('  조건에 맞는 진행중 공고가 없습니다.\n');
}

// 판정 참고 정보
const excluded = meta.categories
  .map((c) => c.value)
  .filter((c) => verdictForCategory(c, profile!) === 'ineligible');
if (excluded.length > 0) console.log(`  (제외된 유형: ${excluded.join(', ')})`);
console.log('\n  ※ 유형별 일반 기준에 따른 참고용 판정입니다. 실제 자격은 공고문 원문을 확인하세요.');
