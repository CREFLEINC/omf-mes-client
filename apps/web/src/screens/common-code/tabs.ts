import { messages } from '@omf-mes/i18n';

/**
 * 탭 정의. **이 배열이 정본이다** — 화면과 테스트가 모두 이 배열을 순회하므로
 * 탭이 늘면 검증도 함께 는다.
 *
 * **만든 탭만 넣는다.** 조직·작업자 탭은 그 탭의 목록·폼이 생기는 작업에서 한 줄씩 더한다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */

const t = messages.commonCode;

export type CommonCodeTabId = 'code' | 'org';

export interface CommonCodeTabDefinition {
  /** 주소의 `tab` 값이자 DS `Tabs`의 항목 값 */
  id: CommonCodeTabId;
  label: string;
}

/** 비어 있지 않은 배열로 두어 「첫 탭」이 언제나 존재함을 타입으로 보장한다. */
export const COMMON_CODE_TABS: readonly [CommonCodeTabDefinition, ...CommonCodeTabDefinition[]] = [
  { id: 'code', label: t.tabs.code },
  { id: 'org', label: t.tabs.org },
];

/**
 * 주소의 `tab` 값을 탭으로 옮긴다. 모르는 값·빈 값이면 첫 탭으로 떨어진다 —
 * 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다.
 *
 * 값을 느슨하게(대소문자 무시 등) 해석하지 않는다. 주소값은 내부 식별자이고,
 * 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다.
 */
export const resolveTab = (param: string | null): CommonCodeTabDefinition =>
  COMMON_CODE_TABS.find((tab) => tab.id === param) ?? COMMON_CODE_TABS[0];

/**
 * 탭을 바꿀 때의 주소. **탭 값 하나만 남긴다.**
 *
 * 탭마다 목록이 통째로 다르다 — 검색어를 넘기면 「부서를 찾던 말」로 작업자를 조회한 결과가 나오고,
 * 선택 번호를 넘기면 그 탭에 없는 자원의 상세를 조회하게 된다.
 */
export const tabSearchParams = (tabId: string): URLSearchParams =>
  new URLSearchParams({ tab: tabId });
