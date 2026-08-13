import { messages } from '@omf-mes/i18n';

/**
 * 탭 정의와 **주소 해석**.
 *
 * 이 화면의 탭은 조회 범위가 아니라 **보는 자리**다 — 두 탭이 서로 다른 대상(고른 입고 전표 ·
 * 고른 품의)을 갖고 각자 살아 있어야 「발의해 놓고 이력에서 이어서 다룬다」가 성립한다.
 * 그래서 탭 전환은 아무 초안도 선택도 비우지 않는다(수명 표 8행).
 *
 * **탭이 이 회차에 처음 생긴다.** 앞 회차에 `Tabs`를 두지 않은 이유는 탭이 하나뿐인 탭 줄이
 * 닿을 수 없는 가지이기 때문이다 — 두 번째 탭이 실제로 생기는 회차에 도입한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/**
 * 탭 둘. **차례가 곧 업무 차례다** — 품의를 올리고(발의), 올라간 품의를 나중에 처리한다.
 *
 * 「결재 대기」 탭을 두지 않는다: 승인·반려는 결재함(W-CO-09)이 소유하며 이 화면은
 * 결재 진행을 **읽기만** 한다.
 */
export const DISPOSAL_ISSUE_TABS = ['disposal', 'history'] as const;

export type DisposalIssueTab = (typeof DISPOSAL_ISSUE_TABS)[number];

/** 화면을 처음 열었을 때 서는 탭. 이 화면에 들어오는 이유가 「폐기 품의를 올린다」라서다. */
export const DEFAULT_TAB: DisposalIssueTab = 'disposal';

/** 주소 키. 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
export const TAB_KEY = 'tab';

const TAB_LABELS: Record<DisposalIssueTab, string> = {
  disposal: t.tabs.disposal,
  history: t.tabs.history,
};

export const tabLabel = (tab: DisposalIssueTab): string => TAB_LABELS[tab];

/**
 * 주소가 가리키는 탭. **모르는 값은 기본 탭으로 본다** — 주소는 손으로 고쳐지는 자리이고,
 * 오타 하나에 아무 탭도 서지 않는 화면을 내면 사용자는 그것을 고장으로 읽는다.
 *
 * 대소문자를 맞춰 주지 않는다 — 우리가 정한 값 그대로만 받는 편이 주소가 두 가지로 갈리는
 * 것보다 낫다.
 */
export const readTab = (params: URLSearchParams): DisposalIssueTab => {
  const raw = params.get(TAB_KEY);

  return DISPOSAL_ISSUE_TABS.find((tab) => tab === raw) ?? DEFAULT_TAB;
};

/**
 * 주소에 적을 값. **기본 탭이면 적지 않는다**(`null`) — 기본값을 주소에 적으면 같은 화면의
 * 주소가 두 가지가 되고, 공유된 주소끼리 달라 보인다.
 */
export const toTabParam = (tab: DisposalIssueTab): string | null =>
  tab === DEFAULT_TAB ? null : tab;
