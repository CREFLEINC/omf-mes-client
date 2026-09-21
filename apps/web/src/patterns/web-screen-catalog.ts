/**
 * 관리웹 화면의 **이름표** — 사이드바 주소 · 설계 화면 코드 · 설계 화면명.
 *
 * ⭐ **왜 따로 두는가.** 서버의 기능 권한 코드는 **설계 화면 코드와 1:1**인데(`Permission.code` ·
 * 사용자 결정 2026-09-01), 사이드바 목록(`app/nav-tree.ts`)이 갖는 것은 **주소와 보이는 이름**뿐이다.
 * 그 둘을 잇는 자리가 여기다. POP 이 같은 문제를 같은 방식으로 풀었다(`pop-screen-catalog.ts`).
 *
 * ⛔ **`NavEntry` 에 `code` 를 더하지 않았다.** 이유 셋 —
 * ① `nav-tree.ts` 는 「차례와 묶음」의 자료이고 화면 코드는 **서버 계약의 축**이라 성격이 다르다.
 *    그 파일의 머리 주석이 「여기에 조건을 들이지 않는다」로 그은 선과 같은 선이다.
 * ② **의존 방향이 갈린다.** 앱 내부는 `routes → screens → patterns` 한 방향이라
 *    (`.dependency-cruiser.cjs` 「app-inner-direction」) `patterns` 는 `app/nav-tree.ts` 를 부를 수
 *    없다. 코드가 `NavEntry` 안에 있으면 **`patterns`·`screens` 는 화면 코드를 영영 못 읽는다.**
 *    여기 있으면 `app` 도 `screens` 도 `patterns` 도 읽는다.
 * ③ 사이드바에 **없는** 화면에도 코드는 있다(로그인 `W-CO-01`·신규 P/O 등록 `W-01-11` 등). 메뉴
 *    항목의 속성으로 두면 그런 화면이 담길 자리가 없다.
 *
 * ⛔ **라우트 표에서 뽑지 않는다.** 위 ②와 같은 이유로 `patterns` 가 `routes` 를 부를 수 없다.
 * 대신 **`routes/web-screen-catalog.test.ts` 가 이 목록을 `NAV_ENTRIES` · `appRouter` 와 대조한다** —
 * 둘 다 부르는 것이 허용되는 자리에 감지기를 두어 방향을 지켰다. 메뉴 항목이 늘거나 주소가 바뀌면
 * 그 시험이 먼저 걸리므로 목록이 조용히 낡지 않는다.
 *
 * ⛔ **여기에 권한 판정을 두지 않는다.** 이 파일은 「어느 주소가 어느 화면 코드인가」라는 **자료**만
 * 갖는다. 「이 세션이 그 코드를 갖고 있는가」는 읽는 쪽이 진다 — 자료와 판정이 한 파일에 섞이면
 * 「왜 안 보이나」를 고칠 자리가 둘로 갈린다.
 *
 * ⚠ **코드는 손으로 붙였다.** 자동 추출할 원천이 없다 — 화면 폴더 89개 중 머리 주석에 자기 코드를
 * 적은 것은 9개뿐이고, 남의 화면을 참조하는 주석에 다른 코드가 섞여 있다. 근거는 고정 설계본 둘이다:
 * `design/wiki/project-spec/04-통합-IA.md` §3-1(메뉴 트리)·§3-2(화면 목록 전건)와
 * `design/wiki/screens/` 아래 `<코드>-<이름>.md` 파일명. **틀어졌을 때 고칠 자리는 이 파일 하나다.**
 */

export interface WebScreen {
  /** 사이드바 항목(`NavEntry.to`)의 주소 그대로. 감지기가 이 값으로 대조한다. */
  path: string;
  /** 설계가 부르는 화면 코드. 서버의 기능 권한 코드와 대조하는 열쇠다. */
  code: string;
  /**
   * **설계가 부르는 화면명**(IA §3-2 · 설계 스펙 파일명).
   *
   * ⚠ **사이드바 라벨(`NavEntry.label`)과 일부러 다르다.** 라벨은 메뉴에서 짧게 읽히도록 줄인
   * 이름이고 이것은 설계 정본의 이름이다 — 둘을 같게 맞추면 이 값이 **코드를 확인할 근거**로서
   * 쓸모를 잃는다. 이 칸이 있어야 「이 주소에 왜 이 코드인가」를 설계 문서에서 한 번에 되짚는다.
   */
  name: string;
}

/**
 * 사이드바 항목 **전건**의 화면 코드 — 그리고 **메뉴에서 뺀 이유를 적은 화면**.
 *
 * ⭐ **차례는 `nav-tree.ts` 의 차례 그대로다** — 두 파일을 나란히 놓고 읽을 수 있어야 빠진 항목이
 * 눈에 띈다. 항목을 옮기거나 더하면 여기도 같은 자리에 옮긴다.
 *
 * ⛔ **메뉴에 없는 화면은 까닭 없이 담지 않는다.** 불변식은 「메뉴 항목 전부가 여기 있다」이고
 * (`routes/web-screen-catalog.test.ts` 가 그 방향을 잰다), 아무 화면이나 섞으면 그 불변식이
 * 「무엇의 전부인가」를 잃는다. 그래서 로그인 `W-CO-01` · 신규 P/O 등록 `W-01-11` · 완제품 재고
 * 조회 `W-04-08` 은 여기 없다.
 *
 * ⚠ **예외 둘 — `W-02-02`·`W-02-03`.** 메뉴에서 뺐지만(omf-all-around#41) 목록에는 남긴다.
 * 화면 코드가 붙은 «갈 수 있는» 자리이고, 앞 화면의 이동 버튼으로 들어간다. 왜 메뉴에 없는지는
 * 그 두 줄 옆에 적었다. 이 갈래를 늘릴 때는 같은 자리에 까닭을 적는다.
 */
export const WEB_SCREENS: readonly WebScreen[] = [
  /* 섹션 밖 맨 위 항목. 어느 업무 묶음에도 속하지 않는 유일한 대시보드다(IA §3-1 「경영 대시보드」). */
  { path: '/dashboard', code: 'W-CO-05', name: '통합 대시보드(경영·생산)' },

  /* ── 기준정보 ─────────────────────────────────────────────────────────── */
  /*
   * ⚠ **이 섹션은 코드가 `W-06` 으로 고르지 않다.** 메뉴 분류(기준정보)와 설계 도메인(06 기준정보)이
   * 대체로 겹치지만 창고 계열 둘은 아니다 — 아래 두 자리에 근거를 적었다.
   */
  { path: '/master-data/warehouse-location', code: 'W-06-07', name: '창고·Location 마스터' },
  /* IA §3-1 「기준정보 > 마스터」. v1.6 신설 화면이고 `W-06-07` 에서 이어진다고 §3-2 가 적었다. */
  { path: '/master-data/putaway-rule', code: 'W-06-14', name: '적치 규칙 마스터' },
  /*
   * ⚠ **06 이 아니라 공통(CO)이다.** IA §3-1 은 이 화면을 「시스템/공통 > 설정」에 두었는데
   * 사이드바는 창고 계열 옆(기준정보)에 세웠다 — 메뉴 배치와 화면 코드의 도메인이 **갈리는 자리**다.
   * 코드는 설계가 붙인 값을 따른다(§3-2 공통 표 · v1.6 재정의로 「창고 적재 위치 배치도」).
   */
  { path: '/master-data/warehouse-layout', code: 'W-CO-08', name: '창고 적재 위치 배치도' },
  { path: '/master-data/routing', code: 'W-06-01', name: 'Routing(공정) 등록·관리' },
  /*
   * ⚠ **`W-06-13`(검사정책 설정)이 아니다.** 그 화면은 속성 11개 중 7개가 이 화면의 테이블에 이미
   * 있어 **`W-06-02` 로 통합·폐지됐다**(2026-08-03 사용자 확정 · 설계 스펙 머리줄). 설계 폴더에
   * 파일이 남아 있으나 폐지 판단의 근거로 남긴 문서이고, 코드로 쓰지 않는다.
   */
  { path: '/master-data/inspection-standard', code: 'W-06-02', name: '검사기준 등록(IQC/PQC/OQC)' },
  {
    path: '/master-data/defect-cause-code',
    code: 'W-06-03',
    name: '불량·원인코드 2계층 마스터',
  },
  {
    path: '/master-data/common-code',
    code: 'W-06-06',
    name: '공통코드·조직·작업자 마스터(다국어)',
  },
  /* 같은 코드값 편집기를 열지만 **화면은 갈린다** — IA §3-1 「기준정보 > 품질 기준」의 독립 항목이다. */
  { path: '/master-data/judgment-code', code: 'W-06-04', name: '판정유형 코드 마스터' },
  /*
   * ⚠ **연계(I/F) 3장 중 하나다.** 나머지 둘(`W-06-09` 연계정의 관리 · `W-06-12` 송신 I/F 정의)은
   * 아직 화면도 메뉴도 없다 — 그 둘이 서면 코드가 헷갈리기 쉬우니 여기 적어 둔다. 이 화면은
   * **실행 로그를 보고 실패를 재처리**하는 쪽이다.
   */
  { path: '/master-data/integration-sync', code: 'W-06-10', name: '연계 동기화 현황·실패 재처리' },
  {
    path: '/master-data/item-extended-attrs',
    code: 'W-06-05',
    name: '수신본 확장속성 편집(품목·BOM)',
  },
  { path: '/master-data/master-change', code: 'W-06-11', name: '마스터 변경관리(신규 Rev 발행)' },

  /* ── 자재창고 ─────────────────────────────────────────────────────────── */
  /*
   * ⚠ **입하 예정은 `W-01-09` 다** — 도메인 01 의 첫 화면이지만 **번호가 01 이 아니다.** 앞자리
   * 번호(`W-01-01`)는 IQC 수입검사이고, 예정 조회는 나중에 도출돼 09 를 받았다(IA §3-2).
   */
  { path: '/logistics/inbound-schedule', code: 'W-01-09', name: '입하 예정 조회' },
  { path: '/logistics/over-receipt-split', code: 'W-01-03', name: '초과 입하 분리' },
  { path: '/logistics/iqc-inspection', code: 'W-01-01', name: 'IQC 수입검사·판정' },
  {
    path: '/logistics/goods-receipt',
    code: 'W-01-10',
    name: '정상품 입하 처리(입고 확정·Release·G/R 송신)',
  },
  {
    path: '/logistics/stock-status',
    code: 'W-01-07',
    name: '재고 현황·상태 조회(위치별 분포 포함)',
  },
  { path: '/logistics/stocktaking', code: 'W-01-04', name: '재고실사' },
  { path: '/logistics/stock-adjust', code: 'W-01-12', name: '재고조정' },
  { path: '/logistics/supplier-return', code: 'W-01-05', name: '공급사 반품 처리' },
  { path: '/logistics/disposal-issue', code: 'W-01-06', name: '폐기 요청·기타출고' },
  { path: '/logistics/iqc-skip-approval', code: 'W-01-02', name: '긴급 IQC 생략 한도승인' },
  { path: '/logistics/document-progress', code: 'W-01-13', name: '물류 문서 진행현황·취소' },

  /* ── 출하 ─────────────────────────────────────────────────────────────── */
  {
    path: '/shipment/shipment-request-create',
    code: 'W-04-01',
    name: '출하지시서 Import·작업지시 생성',
  },
  { path: '/shipment/shipment-schedule', code: 'W-04-02', name: '출하 예정 목록' },
  { path: '/shipment/oqc-inspection', code: 'W-04-03', name: 'OQC 출하검사 판정' },
  /*
   * ⚠ **설계 스펙 파일명이 낡았다** — `W-04-04-출하확정PGI송신.md` 인데 IA v1.4 가 이 화면을
   * 「출하 처리(상차·실물 출고)」로 **개칭·범위 축소**하고 ERP PGI 송신을 `W-04-12` 로 옮겼다.
   * 이름은 IA §3-2(최신)를 따르고, 코드는 그대로다.
   */
  { path: '/shipment/shipment-processing', code: 'W-04-04', name: '출하 처리(상차·실물 출고)' },
  { path: '/shipment/expedited-shipment', code: 'W-04-05', name: '긴급 직행 출하 처리' },
  /* IA v1.4 신설 — 「확정 후 취소」를 없애는 2단 확정의 뒷단이다. `W-04-04` 와 짝이다. */
  { path: '/shipment/shipment-confirm', code: 'W-04-12', name: '출하 확정·취소' },
  { path: '/shipment/return-receipts', code: 'W-04-06', name: '반품·클레임 입고 등록' },
  /*
   * ⚠ **의뢰이지 판정이 아니다.** 판정은 `W-03-10`(처분 판정 처리)이 갖는다 — IA §3-2 가
   * 「04 는 판정하지 않는다」로 못박았다. 두 화면의 코드를 맞바꾸기 쉬운 자리다.
   */
  { path: '/shipment/disposition-requests', code: 'W-04-07', name: '재작업/폐기 판정 의뢰' },
  { path: '/shipment/stock-reinstatements', code: 'W-04-11', name: '재고 재등록' },
  { path: '/shipment/product-disposal-request', code: 'W-04-10', name: '제품 폐기 요청' },

  /* ── 생산 ─────────────────────────────────────────────────────────────── */
  { path: '/production/production-orders', code: 'W-02-01', name: 'ERP W/O 수신·조회' },
  { path: '/production/po-change-review', code: 'W-02-06', name: 'ERP W/O 변경 관리자 확인' },
  /*
   * ⛔ 아래 둘은 **사이드바에 없다**(omf-all-around#41) — 주소에 대상이 실려야 그리는 화면이라
   * 맨 주소로 열면 안내만 선다. 앞 화면의 이동 버튼으로 들어간다. 머리말의 예외 둘이 이것이다.
   */
  { path: '/production/production-plans', code: 'W-02-02', name: 'W/O 전개·편성' },
  {
    path: '/production/work-order-assignments',
    code: 'W-02-03',
    name: '4M 자원배정·유효성 점검',
  },
  {
    path: '/production/work-order-release',
    code: 'W-02-04',
    name: 'W/O 확정·배포·생산LOT 선발행',
  },
  { path: '/production/work-order-close', code: 'W-02-05', name: 'W/O 마감·ERP 실적 송신' },
  /*
   * ⚠ **POP 에도 같은 이름의 화면이 있다**(`P-02-12` 긴급 W/O). 이쪽은 **발행**(관리웹)이고
   * 그쪽은 **현장 투입·실적**(POP)이다. 코드의 프로그램 글자(W/P)가 그 갈림을 진다.
   */
  { path: '/production/emergency-work-orders', code: 'W-02-07', name: '긴급 W/O 발행' },
  {
    path: '/production/material-issue-requests',
    code: 'W-02-10',
    name: '추가 자재 출고 요청(수동)',
  },
  {
    path: '/production/work-order-progress',
    code: 'W-02-08',
    name: 'W/O 진행현황 조회(생산 실적 집계 포함)',
  },

  /* ── 품질관리 ─────────────────────────────────────────────────────────── */
  {
    path: '/quality/lot-status',
    code: 'W-03-01',
    name: 'Lot Status 현황·변경이력 조회',
  },
  { path: '/quality/lot-status-transition', code: 'W-03-02', name: 'Lot Status 판정·전이 처리' },
  { path: '/quality/suspicious-material-hold', code: 'W-03-03', name: '의심자재 등록' },
  /*
   * ⚠ **03 도메인은 번호에 결번이 있다** — `W-03-04`·`W-03-06`·`W-03-07`·`W-03-08` 은 통합·삭제됐고
   * (IA §1) 그중 `W-03-08`(품질 대시보드) 집계분을 이 화면이 흡수했다. 05 를 04 로 잘못 적기 쉽다.
   */
  {
    path: '/quality/inspection-results',
    code: 'W-03-05',
    name: '검사실적·검사결과 조회(불량률·불량코드 분포 집계 포함)',
  },
  { path: '/quality/approvals', code: 'W-03-09', name: '특채·한도승인 승인 처리' },
  { path: '/quality/dispositions', code: 'W-03-10', name: '처분 판정 처리(재작업/폐기/정상)' },

  /* ── 설비/툴 ──────────────────────────────────────────────────────────── */
  /*
   * ⚠ **이 섹션은 메뉴 차례와 코드 번호가 크게 어긋난다.** 사이드바는 「마스터 → 설정 → 일 → 결과」
   * 순으로 섰고 코드는 도출 순서라, 번호를 보고 자리를 짐작하면 틀린다. 한 줄씩 대조한다.
   */
  { path: '/equipment/master', code: 'W-05-12', name: '설비·설비그룹 마스터' },
  { path: '/equipment/tool-master', code: 'W-05-13', name: '툴/금형/지그 마스터' },
  { path: '/equipment/work-calendar', code: 'W-05-09', name: '작업 캘린더(WorkCalendar) 설정' },
  { path: '/equipment/collection-channels', code: 'W-05-07', name: '수집채널 매핑 관리' },
  { path: '/equipment/shot-conversion', code: 'W-05-01', name: '타발수 환산 파라미터 설정' },
  { path: '/equipment/gauge-master', code: 'W-05-11', name: '계측기 마스터 관리' },
  { path: '/equipment/gauge-calibration', code: 'W-05-10', name: '계측기 검교정 이력 등록' },
  { path: '/equipment/failures', code: 'W-05-04', name: '설비 고장 상세·처리' },
  { path: '/equipment/maintenance-orders', code: 'W-05-05', name: '보전 지시 발행' },
  /* ⚠ 예비품 **마스터**는 다른 화면이다(`W-06-08` · 메뉴 없음). 이쪽은 그 예비품의 **출고 등록**이다. */
  { path: '/equipment/maintenance-results', code: 'W-05-06', name: '보전 실적·예비품 출고 등록' },
  { path: '/equipment/tool-pm-order', code: 'W-05-02', name: '툴보전오더 생성(PM 도래 조회)' },
  { path: '/equipment/tool-pm-result', code: 'W-05-03', name: '툴 PM 실적 등록' },
  { path: '/equipment/downtime-summary', code: 'W-05-08', name: '비가동 집계·조회' },

  /* ── 승인 ─────────────────────────────────────────────────────────────── */
  /*
   * ⚠ **결재선 정의(`W-06-15`)와 다른 화면이다.** 그쪽은 「누가 결재하는가」를 정해 두는 운영 설정이라
   * 「시스템 관리」에 있고, 이쪽은 올라온 결재를 처리하는 자리다. 둘이 짝이라 코드를 맞바꾸기 쉽다.
   */
  { path: '/approval/inbox', code: 'W-CO-09', name: '결재함(승인 요청 목록)' },

  /* ── 알림 ─────────────────────────────────────────────────────────────── */
  { path: '/notification/center', code: 'W-CO-03', name: '알림센터' },
  /*
   * ⚠ **알림센터(`W-CO-03`)와 다른 화면이다** — IA §3-2 가 그 구분을 따로 적었다. 알림센터는
   * 「내 알림을 보는 곳」이고 이것은 관리자가 「누가 받을지」를 정하는 곳이다. v1.5 신설(DR-003).
   */
  { path: '/notification/recipient-settings', code: 'W-CO-11', name: '알람 수신자 설정' },
  { path: '/notification/notices', code: 'W-CO-04', name: '공지·전달 게시/조회' },

  /* ── 시스템 관리 ──────────────────────────────────────────────────────── */
  { path: '/system/users-roles', code: 'W-CO-02', name: '사용자·역할·권한 관리' },
  /*
   * ⚠ **06 이지 CO 가 아니다.** IA §3-1 은 이 화면을 「기준정보 > 승인」에 두었는데 사이드바는
   * 운영 설정이라는 성격을 따라 「시스템 관리」에 세웠다 — 메뉴 배치와 코드 도메인이 갈리는 둘째
   * 자리다(첫째는 `/master-data/warehouse-layout`). 코드는 설계가 붙인 값을 따른다.
   */
  { path: '/system/approval-route', code: 'W-06-15', name: '결재선 정의' },
  { path: '/system/terminal-process-map', code: 'W-CO-06', name: '단말기-공정 매핑 설정(EX-10)' },
  /*
   * ⚠ **관리자 초기화(`W-CO-02` 의 액션)와 다른 화면이다** — 이것은 본인이 자기 것을 바꾼다.
   * 그래서 권한으로 감추면 안 되는 자리이기도 하다(`nav-tree.ts` 가 같은 사실을 적어 두었다).
   */
  { path: '/system/password-change', code: 'W-CO-10', name: '비밀번호 변경' },
];
