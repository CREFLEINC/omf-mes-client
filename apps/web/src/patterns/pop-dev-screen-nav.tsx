/**
 * 개발 중 손으로 여는 POP 화면 목록(라우트 대조용). 화면에 서던 개발용 이동 단추는 사번 입력 화면과 함께
 * 없앴다(omf-all-around#334) — 사번을 확인하면 공통 메뉴로 모든 화면에 간다. 이 목록은
 * `routes/pop-dev-screen-nav.test.ts` 가 라우트 표와 대조해, 새 화면의 진입값(`query`)을 적는 자리로 남는다.
 */

export interface PopDevScreen {
  /** 라우트 표에 있는 주소 그대로. 감지기가 이 값으로 대조한다. */
  path: string;
  /** 목록에 보일 이름. 화면 ID를 앞에 둔다 — 설계와 같은 말로 부른다. */
  label: string;
  /**
   * 화면이 요구하는 진입값. **없으면 그 화면은 「대상이 없습니다」로 막힌 채 뜬다.**
   *
   * ⚠ **`pnpm mock`(씨앗 서버)에 실제로 있는 번호여야 한다.** 씨앗이 직접 처리하는 자원에
   * 없는 번호를 적으면 404 가 돌아와, 이 셀렉터가 없애려던 「대상이 없습니다」로 그대로 뜬다
   * (실측 — 포장 번호를 씨앗에 없는 값으로 적었다가 걸렸다). 씨앗에 경로가 없는 것은 계약
   * 예시 서버로 넘어가 어떤 번호에도 답한다.
   *
   * ⛔ 제품 데이터가 아니다. 목 자료가 바뀌면 여기도 함께 바뀐다.
   *
   * ⛔ 이 값을 화면 코드가 읽는 기본값으로 옮기지 않는다. 진입값은 화면을 «부르는 쪽»이
   * 정하는 것이고, 화면이 스스로 지어내면 대상 없이 열린 사실이 가려진다.
   *
   * ⛔ **사번(`workerNo`)은 적지 않는다.** 다섯 화면에 `workerNo=100029` 가 리터럴로 박혀
   * 있었는데, 진입 화면에서 100027 을 지정하고 이 목록으로 넘어가면 **주소가 지정을
   * 덮었다** — 남는 기록이 하지 않은 사람 앞으로 갔다(88단계 시험 결함 2 · #1041). 사번은
   * 「어느 대상인가」가 아니라 「누가 하는가」라 부르는 쪽이 정할 값이 아니다: 지금 단말의
   * 작업자(`worker-session`)가 그대로 따라오므로 적을 필요도 없다. 감지기가 막는다.
   */
  query?: string;
}

/**
 * 갈 수 있는 POP 화면. **라우트 표에서 뽑지 않고 여기에 적는다** — 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라 `patterns`가 `routes`를 부를 수 없다
 * (`.dependency-cruiser.cjs` 「app-inner-direction」).
 *
 * ⭐ **빠진 화면은 감지기가 잡는다.** `routes/pop-dev-screen-nav.test.ts`가 이 목록과
 * `popRoutes`를 대조한다 — 라우트를 부르는 것이 허용되는 자리에 시험을 두어 방향을 지켰다.
 * 새 POP 화면을 붙이면 그 시험이 먼저 걸리므로, 목록이 조용히 낡지 않는다.
 *
 * ⛔ **진입 화면(홈)은 담지 않는다.** 진입값 없이 늘 열리는 자리라 대조에서 뺀다.
 *
 * ⛔ i18n 리소스에 넣지 않는다. 개발 중에만 보이는 문구라 번역 대상이 아니고, 공용 문구
 * 파일은 여러 작업이 동시에 건드리는 자리다.
 */
export const POP_DEV_SCREENS: readonly PopDevScreen[] = [
  { path: '/pop/work-start', label: 'P-02-01 작업지시 목록' },
  { path: '/pop/material-input', label: 'P-02-03 자재 투입 스캔', query: '?workOrderId=11002' },
  {
    path: '/pop/production-result',
    label: 'P-02-04 생산 실적·라벨·LOT 마감',
    /* 현재 생산 LOT이 있는 씨앗 작업지시다. */
    query: '?workOrderId=11002',
  },
  { path: '/pop/material-lot-label', label: 'P-01-01 자재 관리 LOT 라벨' },
  { path: '/pop/rework-results', label: 'P-04-03 재작업 실적 등록' },
  {
    path: '/pop/tool-usage',
    label: 'P-05-01 공구 사용',
    query: '?workOrderId=11002',
  },
  /*
   * ⚠ **설비를 주소로 주지 않는다**(#1149). 이제 화면이 단말에 붙은 설비로 스스로 열리므로,
   *    여기서 번호를 박으면 개발 이동만 «다른 길»을 타 정작 현장이 쓰는 길이 시험되지 않는다
   *    — 이름표도 코드 대신 번호로 서서 실제 화면과 달라 보였다(실측).
   */
  { path: '/pop/downtime', label: 'P-05-02 비가동 등록' },
  {
    path: '/pop/repack-label-issue',
    label: 'P-04-04 재구성 라벨 발행',
  },
  /*
   * ⚠ 이 화면은 사번을 주소로 받지 않는다 — 단말·공정·사번은 셸이 채운다. 개발 셸이 그
   * 자리를 합성값으로 채우므로(`app/pop-main.tsx`) 화면은 서고, 등록 가부는 그 단말·공정의
   * 게이팅 조회 결과가 정한다(F-6).
   */
  {
    path: '/pop/running-change',
    label: 'P-02-11 러닝체인지 부품 교체',
    query: '?workOrderId=11002',
  },
  /* 008 — 출고 전표가 아니라 단말 공장의 분할 LOT 목록이라 진입 컨텍스트가 없다. */
  { path: '/pop/goods-issue-qr', label: 'P-01-02 분할 LOT 라벨' },
  /* ⚠ 서버 경로가 아직 없어 목록이 비어 뜬다 — 배치만 볼 수 있다(SHIP-UNIT-01 P4b). */
  { path: '/pop/shipping-units', label: 'P-04-05 출하 단위 구성' },
  /*
   * ⚠ 이 화면도 진입 컨텍스트를 주소로 받는다(`?workOrderId=`) — 작업지시 선택이 셸에 서기
   * 전까지의 임시 경로다. 사번은 셸·`worker-session` 이 비었을 때만 주소를 본다.
   */
  {
    path: '/pop/work-hold',
    label: 'P-02-10 작업 중단(홀드) 등록',
    query: '?workOrderId=11002',
  },
  /*
   * ⚠ 진입값이 없다 — 이 화면은 납품라벨 스캔으로 스스로 출하를 정한다. 단말·공정·사번은
   * 셸이 채우고, 비어 있을 때만 주소를 본다(`entry-context.ts`).
   */
  { path: '/pop/packing', label: 'P-04-01 출하 포장' },
  /*
   * ⚠ 진입값이 없다 — 이 화면이 창고를 고르는 것부터 시작한다. 사번은 셸·`worker-session`
   * 이 비었을 때만 주소를 본다.
   */
  { path: '/pop/location-label', label: 'P-06-01 창고 적재 위치 라벨 발행' },
  /* ⚠ 진입값이 없다 — LOT 스캔부터 시작한다. */
  { path: '/pop/material-defect', label: 'P-02-14 자재 불량 등록' },
  /* ⚠ 진입값이 없다 — 판정 대기 목록에서 의뢰를 고른다. */
  { path: '/pop/oqc-inspection', label: 'P-04-06 OQC 출하검사 판정' },
  /* ⚠ 진입값이 없다 — 지시서 코드 스캔이나 찾기부터 시작한다(피처 010). */
  { path: '/pop/shipment-complete', label: 'P-04-07 출하 완료' },
];

/** 진입 화면(홈) — 목록에서 뺀다. 감지기가 이 예외를 안다. */
export const POP_DEV_ENTRY_PATH = '/pop/home';
