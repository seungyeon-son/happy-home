# happy—home

LH 청약플러스와 SH 서울주택도시공사의 행복주택·임대·분양 공고를 자동 수집해 보여주는 웹 애플리케이션.

## 실행

```bash
npm install && cd web && npm install && cd ..

# 프론트엔드 빌드 (최초 1회 및 UI 수정 시)
cd web && npm run build && cd ..

# 서버 기동 — 기동 시 1회 + 30분 간격 자동 수집, http://localhost:3000
npm run server
```

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run server` | API + 웹 서빙 + 30분 간격 수집 (통합 운영) |
| `npm run ingest` | 수동 수집 1회. `npm run ingest -- 5` 로 과거 5페이지 백필 |
| `npm run watch` | 수집 데몬만 별도 실행 (서버는 `DISABLE_INGEST=1 npm run server`) |
| `npm run scrape` | 저장 없이 수집 결과만 출력 (파서 점검용) |
| `cd web && npm run dev` | 프론트 개발 서버 (API는 3000 포트로 프록시) |

## 매일/매주 확인하는 법 (배포 없이 맥에서)

**방법 1 — 웹 UI (권장).** 서버를 켜고 브라우저에서 "내 조건" 팝업 사용:

```bash
npm run server
```

http://localhost:3000 접속. 켜져 있는 동안 30분마다 자동 수집한다.

**방법 2 — 터미널 한 줄.** 최신 공고를 가져와 내 조건에 맞는 것만 출력:

```bash
npm run my
```

최초 1회만 조건 등록이 필요하다 (my-profile.json 에 저장, git 추적 제외):

```bash
npm run my -- --setup --nohouse --asset --youth --income=100
```

| 플래그 | 의미 |
|---|---|
| `--nohouse` / `--account` / `--asset` | 무주택 / 청약통장 / 자산기준 충족 |
| `--youth` `--newlywed` `--student` `--senior` `--single-parent` `--recipient` | 해당 사항 (복수 가능) |
| `--income=50\|70\|100\|130\|999` | 도시근로자 월평균소득 대비 |
| `--days=7` | 최근 7일 게시분만 |
| `--region=서울특별시` | 지역 한정 |
| `--no-fetch` | 수집 생략, DB 조회만 |

## 배포 (Vercel, 무료 · 계정 하나면 끝)

1. [vercel.com](https://vercel.com) GitHub 로그인 → **Add New → Project** → 이 저장소 Import
2. 설정 건드릴 것 없이 **Deploy**

환경변수도, 외부 DB도, 크론도 필요 없다. Vercel 에는 영구 디스크가 없으므로
서버리스 함수가 요청을 받을 때 LH·SH 를 직접 수집해서 메모리에 30분 캐시하고,
응답은 CDN 이 한 번 더 캐시한다(`s-maxage=1800`). 실제 공공기관 사이트 호출은 시간당 1~2회.

| | live 모드 (Vercel) | db 모드 (로컬·자체 호스팅) |
|---|---|---|
| 저장소 | 메모리 스냅샷 (DB 없음) | SQLite(libsql) 누적 저장 |
| 수집 | 요청 시 자동 (30분 캐시) | 30분 크론 + `/api/ingest` |
| 공고 범위 | 각 소스 최신 2페이지 (약 120건) | 수집한 모든 공고 누적 |
| NEW 기준 | 게시 48시간 내 | 최초 수집 48시간 내 |

모드는 자동 선택된다 (Vercel = live, 그 외 = db). 로컬에서 Vercel 과 동일하게 돌려보려면:

```bash
npm run server:live
```

자체 호스팅(Docker/Railway 등)은 `Dockerfile` + `npm run server` 로 db 모드 그대로 쓸 수 있고,
그 경우에만 Turso(`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`)와 크론(`CRON_SECRET`)이 의미가 있다.

## 구조

```
src/
  scraper/
    types.ts          Notice 모델 + NoticeSource 어댑터 인터페이스
    http.ts           UA/타임아웃/백오프 재시도/요청 간격 제한
    sources/lh.ts     LH 청약플러스 (임대 mi=1026, 분양 mi=1027)
    sources/sh.ts     SH 공고 게시판 (주택임대 seq=2, 주택분양 seq=1)
  db/                 SQLite (data/happy-home.db) — UNIQUE(source, external_id)
  pipeline/           ingest(멱등 upsert: 신규/변경/동일 판별), watch(스케줄)
  server/             Hono API (/api/notices, /api/meta) + web/dist 정적 서빙
web/                  Vite + React + Tailwind v4 프론트엔드
```

새 기관 추가: `src/scraper/sources/` 에 `NoticeSource` 구현 파일을 만들고
`src/pipeline/ingest.ts` 의 `sources` 배열에 등록하면 끝.

## 스크래핑 전략 요약 (2026-07 실측)

- 두 사이트 모두 서버 렌더링이라 **헤드리스 브라우저 불필요** — HTTP GET + cheerio 파싱
- LH 상세: `selectWrtancInfo.do?panId=…&ccrCnntSysDsCd=…&uppAisTpCd=…&aisTpCd=…` (목록 행 data 속성에서 추출)
- SH 상세: `view.do?seq={게시글번호}`
- 사이트 개편으로 파싱이 깨지면 `npm run scrape` 로 즉시 확인 가능
