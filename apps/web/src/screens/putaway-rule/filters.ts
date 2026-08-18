import { messages } from '@omf-mes/i18n';

import type { RuleFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **이 파일이 소유하는 규칙 넷**
 *
 * | 규칙 | 어디에 |
 * | --- | --- |
 * | 「사용 중만」 ↔ `includeInactive` **방향 뒤집기**와 **늘 명시해 싣기** | `toRuleListQuery` |
 * | 규칙 없는 품목에는 **목록 조건을 싣지 않는다** | `toUncoveredQuery` |
 * | 조건·쪽이 바뀌면 선택(`rule`)이 사라진다 | `toSearchParams`가 그 자리를 **만들지 않는다** |
 * | 창고를 풀면 품목 조건도 함께 풀린다 | `clearFilter` |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  warehouseId: 'wh',
  itemId: 'item',
  activeOnly: 'active',
  page: 'page',
  selected: 'rule',
} as const;

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

/** 식별자로 쓸 수 있는 값인가. 1부터 매겨지므로 0·음수·소수·문자는 어떤 자원도 가리키지 않는다. */
const isIdentifier = (raw: string): boolean => POSITIVE_INTEGER.test(raw) && Number(raw) >= 1;

/**
 * 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다.
 *
 * **`activeOnly`가 꺼져 있다.** 계약 기본값(사용 중인 것만)과 반대인데, 이 마스터에서는
 * 끈 규칙을 다시 켜는 것이 정상 운용이라(이슈 §6) 꺼진 규칙이 첫 화면에 보여야 한다 —
 * 기본을 켜 두면 꺼진 규칙을 찾을 길이 첫 화면에 없다.
 */
export const DEFAULT_FILTERS: RuleFilters = {
  warehouseId: '',
  itemId: '',
  activeOnly: false,
};

/**
 * 주소가 담은 조회 조건.
 *
 * **번호를 식별자 규칙으로 거른다.** 이 값들은 그대로 `Number()`를 거쳐 계약 쿼리로 나가므로,
 * 걸러 내지 않으면 `?wh=abc` 같은 주소가 **`warehouseId=NaN`을 서버로 보낸다.**
 */
export const readFilters = (params: URLSearchParams): RuleFilters => {
  const warehouseId = params.get(URL_KEYS.warehouseId) ?? '';
  const itemId = params.get(URL_KEYS.itemId) ?? '';

  return {
    warehouseId: isIdentifier(warehouseId) ? warehouseId : '',
    itemId: isIdentifier(itemId) ? itemId : '',
    activeOnly: params.get(URL_KEYS.activeOnly) === ON,
  };
};

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return isIdentifier(raw) ? Number(raw) : 1;
};

/** 주소가 가리키는 규칙. 목록에서 고른 행이 새로고침·공유에도 남게 하는 자리다. */
export const readSelectedRuleId = (params: URLSearchParams): number | null => {
  const raw = params.get(URL_KEYS.selected) ?? '';

  return isIdentifier(raw) ? Number(raw) : null;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
 * 같은 화면의 주소가 두 가지가 되면 공유·뒤로가기가 갈린다.
 *
 * **선택(`rule`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로
 * 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다.
 */
export const toSearchParams = (filters: RuleFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  if (filters.warehouseId !== '') next.set(URL_KEYS.warehouseId, filters.warehouseId);
  if (filters.itemId !== '') next.set(URL_KEYS.itemId, filters.itemId);
  if (filters.activeOnly) next.set(URL_KEYS.activeOnly, ON);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 선택을 얹은 주소.
 *
 * **조건과 쪽은 그대로 두고 선택 자리만 다시 세운다** — 규칙을 고르는 것은 보이는 행을
 * 바꾸지 않으므로 조건을 비울 이유가 없다(조건을 비우는 규칙은 `toSearchParams`가 갖는다).
 */
export const toSelectionSearchParams = (
  filters: RuleFilters,
  page: number,
  putawayRuleId: number | null,
): URLSearchParams => {
  const next = toSearchParams(filters, page);

  if (putawayRuleId !== null) next.set(URL_KEYS.selected, String(putawayRuleId));

  return next;
};

/**
 * 계약이 쓰는 목록 쿼리 이름.
 *
 * **`includeInactive`는 선택이 아니다.** 계약에 기본값(사용 중인 것만)이 있으나 생략하면
 * 화면이 무엇을 받는지 단언할 수 없다 — 「보내지 않음」이라는 상태를 만들지 않는다.
 *
 * **`size`가 없다.** 서버 기본값을 쓴다. 화면이 정한 크기를 심으면 그것이 계약처럼 굳는다.
 */
export interface RuleListQuery {
  warehouseId?: number;
  itemId?: number;
  includeInactive: boolean;
  page?: number;
}

/**
 * 서버로 보낼 목록 쿼리.
 *
 * **「사용 중만」과 `includeInactive`는 방향이 반대다.** 뒤집는 자리는 여기 한 곳이다 —
 * 화면 어휘를 이 마스터의 운용에 맞추면서 계약의 사정을 한 줄에 가둔다.
 */
export const toRuleListQuery = (filters: RuleFilters, page: number): RuleListQuery => ({
  ...(filters.warehouseId === '' ? {} : { warehouseId: Number(filters.warehouseId) }),
  ...(filters.itemId === '' ? {} : { itemId: Number(filters.itemId) }),
  includeInactive: !filters.activeOnly,
  ...(page > 1 ? { page } : {}),
});

/**
 * 계약이 쓰는 규칙 없는 품목 쿼리 이름. 창고는 **필수**다.
 *
 * **`page`·`size`를 두지 않는다.** 이 화면은 첫 쪽만 부르고 나머지는 잘림 문구가 말한다 —
 * 옮길 손잡이가 없는데 인자만 두면 죽은 통로가 된다(사본 체크리스트 7번).
 */
export interface UncoveredQuery {
  warehouseId: number;
}

/**
 * 규칙 없는 품목 쿼리.
 *
 * **목록 조건(품목·사용 중만)을 싣지 않는다.** 이 수는 「이 창고에 규칙이 없는 품목이 몇 건인가」
 * 라는 창고 전체의 사실이며, 조건으로 좁히면 조건에 따라 수가 달라져 근거로 쓸 수 없다.
 * 「사용 중만」도 싣지 않는다 — 계약이 활성 규칙이 없는 품목을 세므로 그 판정은 서버 몫이다.
 */
export const toUncoveredQuery = (warehouseId: number): UncoveredQuery => ({ warehouseId });

export type FilterKey = keyof RuleFilters;

export interface RuleFilterChip {
  key: FilterKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * 창고·품목은 **번호가 아니라 이름**으로 낸다 — 번호를 그대로 보이면 사용자가 무엇을 걸었는지
 * 모른다. 이름을 만드는 쪽이 아직 목록을 받지 못했으면 그쪽이 네 갈래 중 하나를 준다.
 */
export const toFilterChips = (
  filters: RuleFilters,
  warehouseLabel: (warehouseId: string) => string,
  itemLabel: (itemId: string) => string,
): RuleFilterChip[] => {
  const chips: RuleFilterChip[] = [];

  if (filters.warehouseId !== '') {
    chips.push({
      key: 'warehouseId',
      label: t.filters.chipWarehouse(warehouseLabel(filters.warehouseId)),
      removeLabel: t.filters.chipRemoveWarehouse,
    });
  }

  if (filters.itemId !== '') {
    chips.push({
      key: 'itemId',
      label: t.filters.chipItem(itemLabel(filters.itemId)),
      removeLabel: t.filters.chipRemoveItem,
    });
  }

  if (filters.activeOnly) {
    chips.push({
      key: 'activeOnly',
      label: t.filters.activeOnly,
      removeLabel: t.filters.chipRemoveActiveOnly,
    });
  }

  return chips;
};

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 *
 * **창고를 풀면 품목도 함께 푼다 — 뜻을 잃기 때문이지 목록이 좁아지기 때문이 아니다.**
 * 이 화면에서 품목 조건은 「이 창고 안에서 이 품목의 규칙」이라는 뜻이라, 창고가 없어지면
 * 남은 품목 조건이 무엇을 가리키는지 정해지지 않는다.
 *
 * ⚠ **품목 선택지 자체는 창고로 좁히지 않는다**(사본 체크리스트 10번 · `#47`). 창고는
 * 품목 조회를 **여느냐 마느냐**만 정하고 **무엇을 받느냐**는 정하지 않는다 — 좁힌 목록으로
 * 이름을 풀면 좁힘 밖의 정상 자료가 「알 수 없음」으로 보인다. 이 파일의 어느 규칙도
 * 그 좁힘을 근거로 삼지 않는다.
 */
export const clearFilter = (filters: RuleFilters, key: FilterKey): RuleFilters => {
  switch (key) {
    case 'activeOnly':
      return { ...filters, activeOnly: false };
    case 'warehouseId':
      return { ...filters, warehouseId: '', itemId: '' };
    case 'itemId':
      return { ...filters, itemId: '' };
  }
};
