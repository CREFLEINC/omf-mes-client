import {
  DEFAULT_SUBSIDIARY_TAB_ID,
  DEFAULT_TAB_ID,
  SUBSIDIARY_TAB_KEY,
  TAB_KEY,
  type ItemExtendedAttrsTabId,
  type SubsidiaryTabId,
} from './tabs';
import type { ItemFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  q: 'q',
  itemType: 'type',
  includeInactive: 'inactive',
  page: 'page',
} as const;

/** 고른 품목의 주소 키. 이 화면의 모든 우 칸 조회가 이 값 하나에 매달린다. */
export const ITEM_KEY = 'item';

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

/** 품목유형의 처음 값 — 원자재(사용자 지시 2026-10-28). 확장 속성을 가장 많이 다는 품목이다. */
export const DEFAULT_ITEM_TYPE = 'RAW_MATERIAL';

/**
 * 「전체」를 고른 품목유형의 주소 값. 처음 값이 원자재라 빈 키는 원자재다 — 전체는 따로 적는다
 * (「BOM 조회 (ERP)」의 `bom=all` 과 같은 방식).
 */
const ALL_TYPES = 'all';

/** 처음 조건(초기화가 돌아가는 곳). 품목유형은 원자재다. */
export const EMPTY_ITEM_FILTERS: ItemFilters = {
  q: '',
  itemType: DEFAULT_ITEM_TYPE,
  includeInactive: false,
};

export const readItemFilters = (params: URLSearchParams): ItemFilters => {
  const itemType = params.get(URL_KEYS.itemType);
  return {
    q: params.get(URL_KEYS.q) ?? '',
    itemType:
      itemType === null || itemType === ''
        ? DEFAULT_ITEM_TYPE
        : itemType === ALL_TYPES
          ? ''
          : itemType,
    includeInactive: params.get(URL_KEYS.includeInactive) === ON,
  };
};

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams, key: string = URL_KEYS.page): number => {
  const raw = params.get(key) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 주소가 가리키는 선택 번호.
 *
 * 식별자는 1부터 매겨지므로 `0`·음수·소수·문자는 어떤 자원도 가리키지 않는다 —
 * 「고르지 않은 것」으로 본다. 걸러 내지 않으면 `?item=abc` 같은 주소가
 * **경로에 `NaN`을 실은 상세 조회**를 내보낸다.
 */
export const readSelectedId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **선택(`item`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로 이 함수의 결과로
 * 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 — 목록에 없는 품목의 폼이 우 칸에 남으면
 * 그것이 어디서 왔는지 알 수 없다.
 *
 * **탭과 하위 탭은 남긴다.** 조건이 바뀌어도 「같은 품목의 어느 면을 보고 있는가」는
 * 달라지지 않는다 — 여기서 탭을 떨구면 조건을 고칠 때마다 첫 탭으로 튕긴다.
 * 하위 탭도 같은 이유로 남긴다. 층이 다르다고 규칙을 달리하면 「외부 코드를 보다가
 * 검색어를 고쳤더니 사업부 매핑으로 돌아오는」 어긋남이 생긴다.
 */
export const toSearchParams = (
  tabId: ItemExtendedAttrsTabId,
  subTabId: SubsidiaryTabId,
  filters: ItemFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();

  if (tabId !== DEFAULT_TAB_ID) next.set(TAB_KEY, tabId);
  if (subTabId !== DEFAULT_SUBSIDIARY_TAB_ID) next.set(SUBSIDIARY_TAB_KEY, subTabId);
  if (filters.q !== '') next.set(URL_KEYS.q, filters.q);
  if (filters.itemType !== DEFAULT_ITEM_TYPE) {
    next.set(URL_KEYS.itemType, filters.itemType === '' ? ALL_TYPES : filters.itemType);
  }
  if (filters.includeInactive) next.set(URL_KEYS.includeInactive, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 값이 없는 조건은 키 자체를 넣지 않는다. */
export interface ItemListQuery {
  q?: string;
  itemTypeCode?: string;
  includeInactive?: boolean;
  page?: number;
}

/**
 * 서버로 보낼 조회 쿼리.
 *
 * **`includeInactive=false`를 명시적으로 보내지 않는다.** 계약의 기본값이 false이고,
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 * 첫 쪽도 같은 이유로 싣지 않는다.
 *
 * **`hasRouting`을 싣지 않는다** — 화면에 그 조건이 없다.
 * 화면에 없는 조건을 요청에 실으면 사용자가 되돌릴 수단이 없다.
 */
export const toItemListQuery = (filters: ItemFilters, page: number): ItemListQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.itemType === '' ? {} : { itemTypeCode: filters.itemType }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
  ...(page > 1 ? { page } : {}),
});

export const hasAnyFilter = (filters: ItemFilters): boolean =>
  filters.q !== '' || filters.itemType !== DEFAULT_ITEM_TYPE || filters.includeInactive;
