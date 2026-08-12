import { messages } from '@omf-mes/i18n';

/**
 * 탭 정의와 **탭 → 조회 쿼리 매핑**.
 *
 * 이 화면에서 탭은 꾸밈이 아니라 **조회 범위 그 자체**다. 그래서 「어떤 탭이 있는가」와
 * 「그 탭이 무엇으로 걸러지는가」를 한 파일에 둔다 — 갈라 두면 탭 이름과 쿼리가 조용히
 * 어긋나고, 그 어긋남은 「탭을 옮겼는데 같은 목록이 나온다」로 나타난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalInbox;

/**
 * 탭 셋. **차례가 곧 화면 차례**다.
 *
 * | 탭 | 걸러 내는 축 | 근거 |
 * | --- | --- | --- |
 * | `pending` | 내가 승인자인 단계가 있고 **아직 끝나지 않은** 요청 | 계약이 그 조합을 「내 결재 대기」 탭이라 적었다 |
 * | `requested` | **내가 올린** 요청 | 상신자가 자기 요청을 보는 자리 |
 * | `all` | 없음 | **지금은 그리지 않는다**(`canSeeAllRequests`) |
 *
 * **`assignedToMe`와 `requestedByMe`를 함께 싣는 탭을 두지 않는다.** 계약이 둘을 함께
 * 실었을 때의 뜻(AND인지 OR인지)을 말하지 않아, 어느 쪽이든 지어내는 것이 된다.
 */
export const INBOX_TABS = ['pending', 'requested', 'all'] as const;

export type InboxTab = (typeof INBOX_TABS)[number];

/** 화면을 처음 열었을 때 서는 탭. 결재함에 들어오는 이유가 「내가 결재할 것」이라서다. */
export const DEFAULT_TAB: InboxTab = 'pending';

/**
 * 「전체」 탭을 볼 수 있는가 — **권한 자리표시**다.
 *
 * 권한 축이 확정되지 않았고(`omf-mes#69`) **이 저장소에는 권한을 아는 수단이 하나도 없다.**
 * 그래서 지금은 언제나 거짓이며, 그것이 「권한이 없으면 탭 자체를 그리지 않는다」는 지시의
 * 이행이다. 탭을 그리되 잠그는 안은 기각했다 — 잠긴 탭은 「권한을 받으면 볼 수 있다」는
 * 뜻인데 누가 그 권한을 받는지 아무도 모른다.
 *
 * **판정이 생기면 이 값 하나가 바뀌고 탭이 선다.** 잠금을 탭 배열이나 부품 안에 굳히면
 * 그때 고칠 자리를 찾아 헤매게 된다 — `visibleTabs`·`readTab`이 이 값만 읽는 이유다.
 *
 * `as boolean`으로 넓히는 것은 의도다. 리터럴로 좁으면 「참일 때」를 다루는 코드가
 * 닿을 수 없는 가지로 보이고, 그러면 전환을 재는 시험이 성립하지 않는다.
 */
export const canSeeAllRequests = false as boolean;

/**
 * 탭이 요청에 싣는 것. **필요 없는 파라미터를 함께 싣지 않는다** —
 * 생략하면 「거르지 않음」이라고 계약이 명시했다.
 *
 * `myTurnOnly`가 여기 없는 것은 일부러다. 그 조건은 **상단 대기 건수의 근거**이고
 * 전용 조회가 갖는다(`queries.ts`) — 탭이 함께 쓰면 건수와 목록이 같은 것을 세는 척하게 된다.
 */
export interface TabScopeQuery {
  assignedToMe?: boolean;
  pendingOnly?: boolean;
  requestedByMe?: boolean;
}

const TAB_SCOPE_QUERIES: Record<InboxTab, TabScopeQuery> = {
  pending: { assignedToMe: true, pendingOnly: true },
  requested: { requestedByMe: true },
  /* 조건 없음 = 전부. 빈 객체가 곧 그 뜻이다. */
  all: {},
};

export const toTabScopeQuery = (tab: InboxTab): TabScopeQuery => ({ ...TAB_SCOPE_QUERIES[tab] });

const TAB_LABELS: Record<InboxTab, string> = {
  pending: t.tabs.pending,
  requested: t.tabs.requested,
  all: t.tabs.all,
};

export const tabLabel = (tab: InboxTab): string => TAB_LABELS[tab];

/**
 * 실제로 그릴 탭. **권한 자리표시를 읽는 유일한 자리 둘 중 하나**다.
 *
 * 차례를 다시 짜지 않고 걸러 내기만 한다 — 권한이 생겼다고 탭 차례가 바뀌면
 * 이미 그 화면에 익숙한 사용자가 다른 곳을 누르게 된다.
 */
export const visibleTabs = (canSeeAll: boolean): InboxTab[] =>
  INBOX_TABS.filter((tab) => tab !== 'all' || canSeeAll);

/**
 * 주소가 가리키는 탭. 모르는 값은 기본 탭으로 본다 — 주소는 손으로 고쳐지는 자리다.
 *
 * **권한이 없으면 「전체」도 모르는 값으로 다룬다.** 그러지 않으면 탭은 서지 않는데
 * `?tab=all` 하나로 조건 없는 조회가 나가, 화면에 보이지 않는 범위의 목록이 그려진다.
 */
export const readTab = (raw: string | null, canSeeAll: boolean): InboxTab => {
  const allowed = visibleTabs(canSeeAll);
  const found = allowed.find((tab) => tab === raw);

  return found ?? DEFAULT_TAB;
};
