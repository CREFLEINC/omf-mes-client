import { messages } from '@omf-mes/i18n';

/**
 * 탭 정의와 **주소 해석**.
 *
 * 이 화면의 탭은 조회 범위가 아니라 **보는 자리**다 — 조정을 세우는 자리와 이미 만들어진
 * 조정을 되찾는 자리가 각자 살아 있어야 「보내 놓고 이력에서 확인한다」가 성립한다.
 * 그래서 탭 전환은 초안도 조건도 비우지 않는다.
 *
 * ⛔ **승인 대기 탭을 두지 않는다**(조심 ① · D-3). 계약의 조정 목록 조회에 그 조건이 남아
 * 있으나 승인·반려는 결재함(W-CO-09)이 소유한다 — 이 목록이 **셋째 탭이 생길 자리**이고,
 * 그래서 이름을 여기 한 곳에만 둔다(화면이 탭 목록을 손으로 다시 적지 않는다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockAdjust;

/**
 * 탭 둘. **차례가 곧 업무 차례다** — 조정을 세워 보내고(등록), 보낸 것을 나중에 되찾는다(이력).
 */
export const STOCK_ADJUST_TABS = ['register', 'history'] as const;

export type StockAdjustTab = (typeof STOCK_ADJUST_TABS)[number];

/** 화면을 처음 열었을 때 서는 탭. 이 화면에 들어오는 이유가 「조정을 세운다」라서다. */
export const DEFAULT_TAB: StockAdjustTab = 'register';

/** 주소 키. 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
export const TAB_KEY = 'tab';

const TAB_LABELS: Record<StockAdjustTab, string> = {
  register: t.tabs.register,
  history: t.tabs.history,
};

export const tabLabel = (tab: StockAdjustTab): string => TAB_LABELS[tab];

/**
 * 주소가 가리키는 탭. **모르는 값은 기본 탭으로 본다** — 주소는 손으로 고쳐지는 자리이고,
 * 오타 하나에 아무 탭도 서지 않는 화면을 내면 사용자는 그것을 고장으로 읽는다.
 *
 * 대소문자를 맞춰 주지 않는다 — 우리가 정한 값 그대로만 받는 편이 주소가 두 가지로 갈리는
 * 것보다 낫다. **없는 탭 이름(`approval` 따위)이 살아남지 않는 자리이기도 하다.**
 */
export const readTab = (params: URLSearchParams): StockAdjustTab => {
  const raw = params.get(TAB_KEY);

  return STOCK_ADJUST_TABS.find((tab) => tab === raw) ?? DEFAULT_TAB;
};

/**
 * 주소에 적을 값. **기본 탭이면 적지 않는다**(`null`) — 기본값을 주소에 적으면 같은 화면의
 * 주소가 두 가지가 되고, 공유된 주소끼리 달라 보인다.
 */
export const toTabParam = (tab: StockAdjustTab): string | null =>
  tab === DEFAULT_TAB ? null : tab;
