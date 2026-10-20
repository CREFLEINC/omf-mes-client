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
  /** 이 화면을 쓰는 **업무 영역(부서)** — 홈·작업 메뉴가 이 값으로 묶고, 상태바가 위치로 보인다. */
  area: PopArea;
  /** 영역 안의 **업무 묶음** — 홈이 관련 화면을 한 카드에 모은다(`POP_TASK_GROUPS`). */
  group: PopTaskGroup;
  /**
   * 부서 화면의 타일·액션바 단추에 서는 **아이콘**(Material Symbols 이름 — DS `Icon`).
   *
   * ⭐ 글보다 먼저 읽힌다. 현장에서는 화면을 이름보다 모양으로 찾는다 — 같은 화면이 어디서나 같은
   *    아이콘으로 서야 한다. ⚠ 폰트는 DS 번들에 실려 있어 오프라인에서도 그려진다.
   */
  icon: string;
  /**
   * **생산 흐름 안에서만 들어가는 화면** — 홈·메뉴에 따로 세우지 않는다.
   *
   * ⭐ 자재 투입·생산 작업은 작업지시를 고른 «뒤» 단계 표시줄·[다음]으로 들어가는 화면이다. 홈에
   *    따로 세우면 작업지시 없이 들어가 「작업 시작에서 고르라」로 막히는 단추가 된다. 하던 일로
   *    돌아가는 길은 홈의 「최근 화면」이 맡는다.
   */
  flowOnly?: true;
}

/**
 * 영역 안의 **업무 묶음** — 관련 화면을 한 카드에 모은다.
 *
 * ⭐ **왜 묶는가.** 홈에 화면 20개를 나란히 세우니 작업자가 자기 일을 찾지 못했다(현장 지적
 *    2026-10-20). 「포장 + 포장 라벨 재출력」, 「작업 중단 + 부품 교체」처럼 같은 순간에 찾는 화면을
 *    한 카드에 두면, 부서 탭 하나에 카드 두세 장만 남는다.
 */
export type PopTaskGroup =
  | 'run'
  | 'packing'
  | 'change'
  | 'materialFlow'
  | 'inspect'
  | 'defect'
  | 'shipPrep'
  | 'rework'
  | 'equipmentLog';

/** 영역별 묶음 순서. 앞의 것일수록 자주 쓴다. */
export const POP_TASK_GROUPS: Readonly<Record<PopArea, readonly PopTaskGroup[]>> = {
  production: ['run', 'packing', 'change'],
  material: ['materialFlow'],
  quality: ['inspect', 'defect'],
  shipping: ['shipPrep', 'rework'],
  equipment: ['equipmentLog'],
};

/**
 * POP 화면을 쓰는 **업무 영역** — 생산 · 구매·자재 · 품질 · 출하 · 설비.
 *
 * ⭐ **왜 화면 코드 번호로 묶지 않는가.** 번호(`P-02`·`P-04`)는 설계 도메인이고 «누가 쓰는가»가
 *    아니다. PQC 검사(`P-02-13`)·자재 불량(`P-02-14`)은 생산 번호지만 품질 담당이 쓰고, OQC
 *    판정(`P-04-06`)은 출하 번호지만 품질 담당이 쓴다. 번호로 묶으면 품질 담당자가 자기 화면을
 *    생산·출하 묶음에서 찾아야 한다.
 *
 * ⚠ **권한이 아니다.** 어느 화면을 열 수 있는지는 단말 정책(`pop-access`)이 정한다. 이 값은 허용된
 *   화면을 «어디에 보일지»만 정한다 — 품질 단말이면 품질 화면만 허용돼 품질 묶음만 보인다.
 */
export type PopArea = 'production' | 'material' | 'quality' | 'shipping' | 'equipment';

/** 부서의 아이콘 — 왼쪽 부서 레일·홈의 부서 카드가 같은 것을 쓴다. */
export const POP_AREA_ICONS: Readonly<Record<PopArea, string>> = {
  production: 'factory',
  material: 'warehouse',
  quality: 'verified',
  shipping: 'local_shipping',
  equipment: 'precision_manufacturing',
};

/** 영역을 보이는 순서. 현장 단말 대다수가 생산이라 먼저 둔다. */
export const POP_AREAS: readonly PopArea[] = [
  'production',
  'material',
  'quality',
  'shipping',
  'equipment',
];

/**
 * 갈 수 있는 POP 화면.
 *
 * ⛔ **홈은 담지 않는다**(`POP_HOME_PATH`). 셸의 자리라 권한으로 거르면 돌아갈 곳이 사라진다.
 *    사번 입력(`P-CO-01`)은 페이지가 아니라 상태바가 여는 창이라 주소가 없다.
 *
 * ⛔ **통합·폐지된 화면을 남겨 두지 않는다**(G-34). 라우트가 걷힌 화면이 목록에 남으면 눌러도
 * 홈으로 되돌아가, 작업자에게는 「눌리지 않는 버튼」으로 보인다.
 */
export const POP_SCREENS: readonly PopScreen[] = [
  {
    path: '/pop/material-lot-label',
    code: 'P-01-01',
    name: '자재LOT 등록·라벨 발행',
    area: 'material',
    group: 'materialFlow',
    icon: 'new_label',
  },
  {
    path: '/pop/goods-issue-qr',
    code: 'P-01-02',
    name: '자재 출고 QR 발행',
    area: 'material',
    group: 'materialFlow',
    icon: 'qr_code_2',
  },
  {
    path: '/pop/work-start',
    code: 'P-02-01',
    name: '작업 시작',
    area: 'production',
    group: 'run',
    icon: 'play_circle',
  },
  {
    path: '/pop/material-input',
    code: 'P-02-03',
    name: '자재 투입',
    acceptsWorkOrderId: true,
    area: 'production',
    group: 'run',
    icon: 'move_to_inbox',
    flowOnly: true,
  },
  {
    path: '/pop/production-result',
    code: 'P-02-04',
    name: '생산 작업',
    acceptsWorkOrderId: true,
    area: 'production',
    group: 'run',
    icon: 'precision_manufacturing',
    flowOnly: true,
  },
  /*
   * ⭐ 아래 셋은 작업지시를 주소로 받는다 — 작업 시작 화면이 이미 `?workOrderId=` 를 실어 보내고
   *    있었고(#42) 각 화면의 주소 읽기(`entry-context`·`screen-params`)가 그 값을 읽는다.
   *    작업장 콘솔의 이상 보고 단추가 같은 값을 실어 가려면 여기 표기가 있어야 한다.
   */
  {
    path: '/pop/packing-work',
    code: 'P-02-08',
    name: '생산 포장',
    acceptsWorkOrderId: true,
    area: 'production',
    group: 'packing',
    icon: 'package_2',
  },
  {
    path: '/pop/packing-label-reprint',
    code: 'P-02-09',
    name: '포장 라벨 재출력',
    area: 'production',
    group: 'packing',
    icon: 'print',
  },
  {
    path: '/pop/work-hold',
    code: 'P-02-10',
    name: '작업 중단',
    acceptsWorkOrderId: true,
    area: 'production',
    group: 'change',
    icon: 'pause_circle',
  },
  {
    path: '/pop/running-change',
    code: 'P-02-11',
    name: '러닝체인지 부품 교체',
    acceptsWorkOrderId: true,
    area: 'production',
    group: 'change',
    icon: 'published_with_changes',
  },
  {
    path: '/pop/emergency-work-orders',
    code: 'P-02-12',
    name: '긴급 W/O',
    area: 'production',
    group: 'run',
    icon: 'bolt',
  },
  /* ⭐ 생산 번호지만 품질 담당이 쓴다(공정 검사) — 영역은 품질이다. */
  {
    path: '/pop/pqc-inspection',
    code: 'P-02-13',
    name: 'PQC 제품 검사',
    area: 'quality',
    group: 'inspect',
    icon: 'fact_check',
  },
  /* ⭐ 설계보다 앞선 화면이다(omf-all-around#108) — 화면 코드는 사용자 결정으로 부여했다. */
  {
    path: '/pop/material-defect',
    code: 'P-02-14',
    name: '자재 불량 등록',
    area: 'quality',
    group: 'defect',
    icon: 'report',
  },
  {
    path: '/pop/packing',
    code: 'P-04-01',
    name: '출하 포장',
    area: 'shipping',
    group: 'shipPrep',
    icon: 'inventory',
  },
  {
    path: '/pop/rework-results',
    code: 'P-04-03',
    name: '재작업 실적 등록',
    area: 'shipping',
    group: 'rework',
    icon: 'build',
  },
  {
    path: '/pop/repack-label-issue',
    code: 'P-04-04',
    name: '재구성 신규 라벨 발행',
    area: 'shipping',
    group: 'shipPrep',
    icon: 'label',
  },
  {
    path: '/pop/shipping-units',
    code: 'P-04-05',
    name: '출하 단위 구성',
    area: 'shipping',
    group: 'shipPrep',
    icon: 'pallet',
  },
  /*
   * ⭐ 설계보다 앞선 화면이다(omf-all-around#109) — 화면 코드는 사용자 결정으로 부여했다.
   *    출하 번호지만 판정은 품질 담당이 한다 — 영역은 품질이다.
   */
  {
    path: '/pop/oqc-inspection',
    code: 'P-04-06',
    name: 'OQC 출하검사 판정',
    area: 'quality',
    group: 'inspect',
    icon: 'verified',
  },
  {
    path: '/pop/tool-usage',
    code: 'P-05-01',
    name: '툴 사용실적 입력',
    area: 'equipment',
    group: 'equipmentLog',
    icon: 'handyman',
  },
  {
    path: '/pop/downtime',
    code: 'P-05-02',
    name: '비가동 실적 입력',
    area: 'equipment',
    group: 'equipmentLog',
    icon: 'timer_off',
  },
  /*
   * ⭐ **설계보다 앞선 화면이다**(`docs/decisions.md` 결정 16) — 화면 코드도 클라이언트가
   *    부여했다. 도메인 06(기준정보연계)에 POP 화면이 없어 번호 체계를 그대로 이었다.
   */
  {
    path: '/pop/location-label',
    code: 'P-06-01',
    name: '창고 적재 위치 라벨 발행',
    area: 'material',
    group: 'materialFlow',
    icon: 'shelves',
  },
];

/**
 * **홈** — 단말을 켜면 서는 진입 화면이자, 어느 화면에서든 [홈]이 데려가는 자리.
 *
 * ⭐ **업무 화면이 아니라 셸의 자리다.** 화면 코드가 없고 권한으로 막지 않는다 — 홈이 막히면
 *    돌아갈 곳이 사라진다. 그래서 이 목록(`POP_SCREENS`)에 담지 않는다. 목록에서 빠지는 것이
 *    정상이라는 사실을 감지기가 이 값으로 확인한다.
 */
export const POP_HOME_PATH = '/pop/home';

/**
 * **부서 화면** — 한 부서의 업무 묶음과 화면 타일. 왼쪽 부서 레일과 홈의 부서 카드가 데려간다.
 *
 * ⭐ 홈처럼 셸의 자리라 목록(`POP_SCREENS`)에 담지 않고 권한으로 막지 않는다 — 이 단말에 허용된
 *    화면이 없는 부서는 레일에 서지 않을 뿐이다.
 */
export const POP_AREA_PATH_PREFIX = '/pop/area/';

export const popAreaPath = (area: PopArea): string => `${POP_AREA_PATH_PREFIX}${area}`;

/** 주소의 부서 화면. 부서 화면이 아니거나 모르는 부서면 `null`. */
export const popAreaAt = (pathname: string): PopArea | null => {
  if (!pathname.startsWith(POP_AREA_PATH_PREFIX)) return null;

  const slug = pathname.slice(POP_AREA_PATH_PREFIX.length);

  return POP_AREAS.find((area) => area === slug) ?? null;
};

/** 주소의 화면. 홈처럼 목록에 없는 주소는 `null`. */
export const popScreenAt = (pathname: string): PopScreen | null =>
  POP_SCREENS.find((screen) => screen.path === pathname) ?? null;
