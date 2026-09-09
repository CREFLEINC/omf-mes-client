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
  /** 목록에 보일 이름. 설계 화면명을 그대로 쓴다. */
  name: string;
}

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
  { path: '/pop/material-lot-label', code: 'P-01-01', name: '자재LOT 등록·라벨' },
  { path: '/pop/goods-issue-qr', code: 'P-01-02', name: '출고 QR 발행' },
  { path: '/pop/work-start', code: 'P-02-01', name: '작업 시작' },
  { path: '/pop/material-input', code: 'P-02-03', name: '자재 투입 스캔' },
  { path: '/pop/production-result', code: 'P-02-04', name: '생산 실적 등록' },
  { path: '/pop/packing-work', code: 'P-02-08', name: '포장 작업' },
  { path: '/pop/packing-label-reprint', code: 'P-02-09', name: '포장 라벨·인식표 재출력' },
  { path: '/pop/work-hold', code: 'P-02-10', name: '작업 중단(홀드) 등록' },
  { path: '/pop/running-change', code: 'P-02-11', name: '러닝체인지 부품 교체' },
  { path: '/pop/emergency-work-orders', code: 'P-02-12', name: '긴급 작업지시' },
  { path: '/pop/pqc-inspection', code: 'P-02-13', name: 'PQC 제품 검사' },
  { path: '/pop/packing', code: 'P-04-01', name: '출하 실적 등록' },
  { path: '/pop/rework-results', code: 'P-04-03', name: '재작업 실적 등록' },
  { path: '/pop/repack-label-issue', code: 'P-04-04', name: '재구성 신규 라벨 발행' },
  { path: '/pop/tool-usage', code: 'P-05-01', name: '공구 사용 실적·타발수 입력' },
  { path: '/pop/downtime', code: 'P-05-02', name: '비가동 실적 입력' },
];

/** 진입 화면. 목록에서 빠지는 것이 정상이라는 사실을 감지기가 이 값으로 확인한다. */
export const POP_ENTRY_SCREEN_PATH = '/pop/worker-assignment';
