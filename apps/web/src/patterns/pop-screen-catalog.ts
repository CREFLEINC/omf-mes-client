import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

type TerminalWorkCountKey = keyof components['schemas']['TerminalWorkCounts'];

/**
 * POP 화면의 **이름표** — 주소 · 화면 코드 · 화면명.
 *
 * ⭐ **왜 따로 두는가.** [화면 이동](공유계약 G-34)은 「어디로 갈 수 있는가」를 두 가지로
 * 판정한다 — ① 이 설치본에 그 화면이 서 있는가(라우트 표) ② 이 단말이 그 화면을 볼 권한이
 * 있는가(세션 권한 코드). ②의 열쇠가 **화면 코드**인데 라우트 표에는 주소만 있다. 그 둘을
 * 잇는 자리가 여기다.
 *
 * ⛔ **라우트 표에서 뽑지 않는다.** 앱 내부 의존은 `routes → screens → patterns` 한 방향이라
 * `patterns` 가 `routes` 를 부를 수 없다(`.dependency-cruiser.cjs` 「app-inner-direction」).
 * 대신 **`routes/pop-screen-catalog.test.ts` 가 이 목록과 `popRoutes` 를 대조한다** — 라우트를
 * 부르는 것이 허용되는 자리에 감지기를 두어 방향을 지켰다. 새 POP 화면을 붙이거나 화면을
 * 폐지하면 그 시험이 먼저 걸리므로 목록이 조용히 낡지 않는다.
 *
 * ⚠ **화면 코드는 서버가 권한 코드로 쓰는 값과 같은 문자열이어야 한다.** 계약이
 * 「`permission_code` 는 화면 코드와 1:1」이라고 밝혔고(`Permission.code` · 사용자 결정
 * 2026-09-01), 그 값이 실제로 어떤 대소문자·구분자로 오는지는 아직 실물 응답으로 보지 못했다
 * (목 서버에 `/app/sessions/current` 가 없다). **틀어졌을 때 고칠 자리는 이 파일 하나다.**
 */

export interface PopScreen {
  /** 라우트 표에 있는 주소 그대로. 감지기가 이 값으로 대조한다. */
  path: string;
  /** 설계가 부르는 화면 코드. 세션 권한 코드와 대조하는 열쇠다. */
  code: string;
  /**
   * 목록에 보일 이름. **들어간 화면의 머리줄 타이틀과 같은 말이다**(사용자 지시 2026-09-15) —
   * 목록에서 누른 이름과 열린 화면의 이름이 다르면 작업자가 제대로 왔는지 의심한다.
   * ⚠ 화면 타이틀을 바꾸면 여기도 함께 고친다.
   */
  name: string;
  /**
   * **작업지시를 주소로 받는 화면인가.** [화면 이동]은 이 표기가 있는 화면으로 갈 때만 지금
   * 주소의 `workOrderId` 를 실어 준다(사용자 승인 2026-09-15 · WIP-CHAIN-01 D10).
   *
   * ⛔ **추측으로 넓히지 않는다.** 받지 않는 화면에 인자를 실으면 그 화면이 모르는 값이 주소에
   *    남고, 뒤에 그 이름을 쓰게 되면 «남이 남긴 값»으로 조회가 선다. 받는 화면이 늘면 그 화면의
   *    주소 읽기(`screen-params`)와 함께 여기에 적는다.
   */
  acceptsWorkOrderId?: true;
  /**
   * 남은 작업 수의 키(`/app/terminal-work-counts`, 피처 002). 인계 작업을 처리하는 화면만 갖는다 —
   * 화면 이동 창이 이 화면 항목 뒤에 수를 붙인다.
   */
  countKey?: TerminalWorkCountKey;
  /** 묶음 줄(자재·생산·품질·출하·설비·창고)에서 이 화면이 속한 묶음(#291). */
  group: PopScreenGroupKey;
  /**
   * 작업지시를 고른 뒤 거치는 화면인가(#291 · 사용자 승인 2026-11-17). 이런 화면은 탭에 두지 않고
   * 「작업 지시 목록」 탭 아래 작업 단계 줄에서 연다.
   * - `step`: 차례대로 거치는 단계(이 목록 순서가 단계 순서다 — ② 자재 투입 · ③ 생산 작업 · ④ 생산 포장).
   * - `during`: 작업 중 언제든 여는 화면(작업 중단 · 러닝체인지 · 툴 사용실적) — 단계 줄 오른쪽 버튼.
   */
  workFlow?: 'step' | 'during';
  /**
   * 설비가 지정된 단말에서만 보이는가(사용자 지시 2026-11-17 · #291). 서버가 단말 «자기 설비»로만 기록을
   * 받으므로(비가동) 설비가 없는 단말에서는 메뉴·바로가기·남은 작업 어디에도 세우지 않는다.
   */
  needsEquipment?: true;
}

/** 작업 단계 ①(작업지시 고르기) 화면. */
export const POP_WORK_ENTRY_PATH = '/pop/work-start';

export type PopScreenGroupKey = 'material' | 'production' | 'quality' | 'shipping' | 'facility';

/**
 * 묶음 줄의 순서와 이름(#291). 화면 코드 앞자리로 나누되, 품질 검사 화면(P-02-13·P-04-06)은
 * 생산·출하가 아니라 품질에 둔다.
 */
export const POP_SCREEN_GROUPS: readonly { key: PopScreenGroupKey; name: string }[] = [
  { key: 'material', name: '자재' },
  { key: 'production', name: '생산' },
  { key: 'quality', name: '품질' },
  { key: 'shipping', name: '출하' },
  { key: 'facility', name: '설비·창고' },
];

/**
 * 라우트는 남기되 [화면 이동] 후보에서 **감춘** POP 화면(피처 010 · omf-all-around#305).
 *
 * 출하는 PDA 피킹 → OQC → P-04-07 「출하 완료」로 끝나 포장(P-04-01) · 재구성 라벨(P-04-04) ·
 * 출하 단위(P-04-05)를 쓰지 않는다. 화면을 지우지 않는 이유는 배포 전 진행분 때문이다 — 주소로는
 * 여전히 열린다. `routes/pop-screen-catalog.test.ts` 가 이 목록을 라우트 표와 대조한다.
 */
export const POP_HIDDEN_SCREEN_PATHS: readonly string[] = [
  '/pop/packing',
  '/pop/repack-label-issue',
  '/pop/shipping-units',
];

/**
 * 갈 수 있는 POP 화면.
 *
 * ⛔ **진입 화면(`P-CO-01` · `/pop/worker-assignment`)은 담지 않는다.** 그 화면으로 가는 길은
 * [사용자 전환]이고, 여기에 두면 사번을 지우지 않은 채 진입 화면이 열려 두 길이 어긋난다.
 *
 * ⛔ **통합·폐지된 화면을 남겨 두지 않는다**(G-34). 라우트가 걷힌 화면이 목록에 남으면 눌러도
 * 진입 화면으로 되돌아가, 작업자에게는 「눌리지 않는 버튼」으로 보인다.
 */
export const POP_SCREENS: readonly PopScreen[] = [
  {
    path: '/pop/material-lot-label',
    code: 'P-01-01',
    group: 'material',
    name: '자재 관리 LOT 라벨',
  },
  { path: '/pop/goods-issue-qr', code: 'P-01-02', group: 'material', name: '분할 LOT 라벨' },
  {
    path: '/pop/work-start',
    code: 'P-02-01',
    group: 'production',
    name: '작업 지시 목록',
    countKey: 'workStart',
  },
  {
    path: '/pop/material-input',
    code: 'P-02-03',
    group: 'production',
    name: '자재 투입',
    acceptsWorkOrderId: true,
    workFlow: 'step',
  },
  {
    path: '/pop/production-result',
    code: 'P-02-04',
    group: 'production',
    name: '생산 작업',
    acceptsWorkOrderId: true,
    workFlow: 'step',
  },
  {
    path: '/pop/work-hold',
    code: 'P-02-10',
    group: 'production',
    name: '작업 중단',
    acceptsWorkOrderId: true,
    workFlow: 'during',
  },
  {
    path: '/pop/running-change',
    code: 'P-02-11',
    group: 'production',
    name: '러닝체인지 부품 교체',
    acceptsWorkOrderId: true,
    workFlow: 'during',
  },
  {
    path: '/pop/emergency-work-orders',
    code: 'P-02-12',
    group: 'production',
    name: '긴급 W/O',
    countKey: 'emergencyWorkOrder',
  },
  /* ⭐ 설계보다 앞선 화면이다(omf-all-around#108) — 화면 코드는 사용자 결정으로 부여했다. */
  { path: '/pop/material-defect', code: 'P-02-14', group: 'production', name: '자재 불량 등록' },
  /* ⭐ 설계보다 앞선 화면이다(omf-all-around#89 · 서버 장부 P-102). */
  {
    path: '/pop/rework-results',
    code: 'P-04-03',
    group: 'shipping',
    name: '재작업 실적 등록',
    countKey: 'reworkResult',
  },
  /* 피처 010(omf-all-around#305) — 출하는 이 화면의 [출하 완료]로 끝난다. 탭 끝 배지는 완료 대기 수다. */
  {
    path: '/pop/shipment-complete',
    code: 'P-04-07',
    group: 'shipping',
    /*
     * 단말 언어를 따른다(둘러보기 W-7) — 화면 머리줄 이름(`popShipmentComplete.title`)과 같은 말이다. 읽을 때 고른
     * 언어로 읽는다(모듈이 실릴 때 붙잡지 않는다). ⚠ 다른 탭 이름은 010 전부터 한국어 고정이라 이번에 손대지 않았다.
     */
    get name(): string {
      return messages.popShipmentComplete.title;
    },
    countKey: 'shipmentCompletion',
  },
  /* ⭐ 설계보다 앞선 화면이다(omf-all-around#109) — 화면 코드는 사용자 결정으로 부여했다. */
  {
    path: '/pop/oqc-inspection',
    code: 'P-04-06',
    group: 'quality',
    name: 'OQC 출하검사 판정',
    countKey: 'oqcInspection',
  },
  /* 작업지시를 주소로 받는다(`tool-usage/entry-context`) — 작업 단계 줄에서 고른 W/O 를 싣는다(#291). */
  {
    path: '/pop/tool-usage',
    code: 'P-05-01',
    group: 'facility',
    name: '툴 사용실적 입력',
    acceptsWorkOrderId: true,
    workFlow: 'during',
  },
  {
    path: '/pop/downtime',
    code: 'P-05-02',
    group: 'facility',
    name: '비가동 실적 입력',
    needsEquipment: true,
  },
  /*
   * ⭐ **설계보다 앞선 화면이다**(`docs/decisions.md` 결정 16) — 화면 코드도 클라이언트가
   *    부여했다. 도메인 06(기준정보연계)에 POP 화면이 없어 번호 체계를 그대로 이었다.
   */
  {
    path: '/pop/location-label',
    code: 'P-06-01',
    group: 'facility',
    name: '창고 적재 위치 라벨 발행',
  },
];

/** 진입 화면. 목록에서 빠지는 것이 정상이라는 사실을 감지기가 이 값으로 확인한다. */
export const POP_ENTRY_SCREEN_PATH = '/pop/worker-assignment';

/**
 * 홈(#291) — 사번 확인 뒤 처음 서는 화면. 권한 코드가 없는 안내 화면이라 `POP_SCREENS`(권한으로
 * 거르는 이동 후보)에 담지 않고, 공통 메뉴의 [홈] 단추로만 간다.
 */
export const POP_HOME_PATH = '/pop/home';
