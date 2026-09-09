import { messages } from '@omf-mes/i18n';

/**
 * 탭 정의와 **주소 해석**.
 *
 * 설계서 §3 이 탭 둘을 세웠다 — 요청을 올리는 자리와, 올라간 요청을 나중에 보는 자리다.
 * **차례가 곧 업무 차례다.**
 *
 * ⛔ **「결재 대기」 탭을 두지 않는다** — 승인·반려는 결재함(`W-CO-09`)이 소유하고 이 화면은
 * 결재 진행을 **읽기만** 한다(J-10).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.productDisposalRequest;

export const DISPOSAL_REQUEST_TABS = ['request', 'history'] as const;

export type DisposalRequestTab = (typeof DISPOSAL_REQUEST_TABS)[number];

/** 처음 서는 탭. 이 화면에 들어오는 이유가 「폐기 요청을 올린다」라서다. */
export const DEFAULT_TAB: DisposalRequestTab = 'request';

/** 주소 키. 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
export const TAB_KEY = 'tab';

const TAB_LABELS: Record<DisposalRequestTab, string> = {
  request: t.tabs.request,
  history: t.tabs.history,
};

export const tabLabel = (tab: DisposalRequestTab): string => TAB_LABELS[tab];

/**
 * 주소가 가리키는 탭.
 *
 * ⭐ **모르는 값은 기본 탭으로 본다** — 주소는 손으로 고쳐지는 자리이고, 오타 하나에 아무 탭도
 * 서지 않는 화면을 내면 사용자는 그것을 고장으로 읽는다.
 */
export const readTab = (params: URLSearchParams): DisposalRequestTab => {
  const raw = params.get(TAB_KEY);

  return DISPOSAL_REQUEST_TABS.find((tab) => tab === raw) ?? DEFAULT_TAB;
};

/**
 * 주소에 적을 값.
 *
 * ⭐ **기본 탭이면 적지 않는다**(`null`) — 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가
 * 되고, 공유된 주소끼리 달라 보인다.
 */
export const toTabParam = (tab: DisposalRequestTab): string | null =>
  tab === DEFAULT_TAB ? null : tab;
