import { messages } from '@omf-mes/i18n';

/**
 * 품목 탭 오른쪽 구획의 보기 상태 — 확장 속성 / 단위 환산 / 설비·금형. 품목 / BOM 은 셸 탭 막대가 가른다(주소가 다르다).
 * 예전에는 단위 환산 · 설비·금형이 「부속 정보」 탭 안의 하위 탭이었다 — 사업부 매핑 · 외부 코드를 뺀 뒤 둘만 남아
 * 같은 줄로 올렸다(사용자 지시 2026-11-24).
 */

const t = messages.itemExtendedAttrs;

export type ItemExtendedAttrsTabId = 'attrs' | 'uom' | 'res';

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
] = [
  { id: 'attrs', label: t.tabs.attrs },
  { id: 'uom', label: t.tabs.uomConversion },
  { id: 'res', label: t.tabs.resourceMap },
];

/** 오른쪽 구획의 탭. */
export const ITEM_DETAIL_TABS = ITEM_EXTENDED_ATTRS_TABS;

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
