import { messages } from '@omf-mes/i18n';

/**
 * 우 칸 탭 정의. **이 배열이 정본이다** — 화면과 테스트가 모두 이 배열을 순회하므로
 * 탭이 늘면 검증도 함께 는다.
 *
 * **만든 탭만 넣는다.** 탭은 그 탭의 내용이 생기는 작업에서 한 줄씩 더한다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 *
 * **탭이 좌 목록을 가르지 않는다.** 세 탭이 전부 「지금 고른 품목」의 다른 면이라
 * 좌 목록은 탭 밖에 있고, 탭을 옮겨도 조건·선택은 그대로다(결정 2·M09).
 */

const t = messages.itemExtendedAttrs;

export type ItemExtendedAttrsTabId = 'attrs';

export interface ItemExtendedAttrsTabDefinition {
  /** 주소의 `tab` 값이자 DS `Tabs`의 항목 값 */
  id: ItemExtendedAttrsTabId;
  label: string;
}

/** 주소 키. 조회 조건과 같은 주소에 산다. */
export const TAB_KEY = 'tab';

/** 비어 있지 않은 배열로 두어 「첫 탭」이 언제나 존재함을 타입으로 보장한다. */
export const ITEM_EXTENDED_ATTRS_TABS: readonly [
  ItemExtendedAttrsTabDefinition,
  ...ItemExtendedAttrsTabDefinition[],
] = [{ id: 'attrs', label: t.tabs.attrs }];

/**
 * 기본 탭. **주소에 쓰지 않는다** — 「빈 조건·기본값은 키 자체를 두지 않는다」는
 * 이 화면의 주소 규칙을 탭에도 그대로 적용한다.
 */
export const DEFAULT_TAB_ID: ItemExtendedAttrsTabId = ITEM_EXTENDED_ATTRS_TABS[0].id;

/**
 * 주소의 `tab` 값을 탭으로 옮긴다. 모르는 값·빈 값이면 첫 탭으로 떨어진다 —
 * 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다.
 *
 * 값을 느슨하게(대소문자 무시 등) 해석하지 않는다. 주소값은 내부 식별자이고,
 * 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다.
 */
export const resolveTab = (param: string | null): ItemExtendedAttrsTabDefinition =>
  ITEM_EXTENDED_ATTRS_TABS.find((tab) => tab.id === param) ?? ITEM_EXTENDED_ATTRS_TABS[0];
