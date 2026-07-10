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
