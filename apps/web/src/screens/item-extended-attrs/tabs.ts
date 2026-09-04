import { messages } from '@omf-mes/i18n';

/**
 * 주소의 보기 상태. 기존 공유 주소(`attrs`·`sub`·`bom`)를 유지하면서 화면에서는
 * 고정 설계에 맞게 품목/BOM 상위 구획과 품목 세부 구획으로 나눠 그린다.
 */

const t = messages.itemExtendedAttrs;

export type ItemExtendedAttrsSectionId = 'item' | 'bom';

export interface ItemExtendedAttrsSectionDefinition {
  id: ItemExtendedAttrsSectionId;
  label: string;
}

/** 고정 설계의 최상위 정보 구조. 품목의 세부 편집 탭과 섞지 않는다. */
export const ITEM_EXTENDED_ATTRS_SECTIONS: readonly [
  ItemExtendedAttrsSectionDefinition,
  ItemExtendedAttrsSectionDefinition,
] = [
  { id: 'item', label: t.sections.item },
  { id: 'bom', label: t.sections.bom },
];

export type ItemExtendedAttrsTabId = 'attrs' | 'sub' | 'bom';

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
  { id: 'sub', label: t.tabs.subsidiary },
  { id: 'bom', label: t.tabs.bom },
];

/** 품목 상위 구획 안에서만 보이는 세부 탭. */
export const ITEM_DETAIL_TABS = ITEM_EXTENDED_ATTRS_TABS.filter((tab) => tab.id !== 'bom');

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

/* ── 부속 정보 안의 하위 탭 ───────────────────────────────────────────────── */

/**
 * 부속 자원 셋. **탭 안의 탭이다**(결정 2).
 *
 * 계약이 인용한 화면 스펙의 구획 이름(「부속 정보」)을 그대로 옮긴 결과다.
 * 평평한 탭 다섯으로 펴는 대안이 있으나 그러면 그 구획 이름이 사라진다.
 *
 * **세 자원은 서로를 알지 않는다**(결정 6) — 같은 모양이되 필드도 검증도 다르다.
 * 여기 있는 것은 「어느 하위 탭인가」뿐이고, 자원의 규칙은 각 파일이 갖는다.
 */
export type SubsidiaryTabId = 'bu' | 'uom' | 'ext';

export interface SubsidiaryTabDefinition {
  id: SubsidiaryTabId;
  label: string;
}

/** 하위 탭의 주소 키. 바깥 탭과 같은 주소에 살되 키가 다르다. */
export const SUBSIDIARY_TAB_KEY = 'sub';

export const SUBSIDIARY_TABS: readonly [SubsidiaryTabDefinition, ...SubsidiaryTabDefinition[]] = [
  { id: 'bu', label: t.subTabs.buMap },
  { id: 'uom', label: t.subTabs.uomConversion },
  { id: 'ext', label: t.subTabs.externalCode },
];

/** 기본 하위 탭. 바깥 탭과 같은 규칙으로 **주소에 쓰지 않는다.** */
export const DEFAULT_SUBSIDIARY_TAB_ID: SubsidiaryTabId = SUBSIDIARY_TABS[0].id;

export const resolveSubsidiaryTab = (param: string | null): SubsidiaryTabDefinition =>
  SUBSIDIARY_TABS.find((tab) => tab.id === param) ?? SUBSIDIARY_TABS[0];
