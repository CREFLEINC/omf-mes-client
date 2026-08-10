import type { SelectOption, SelectOptionGroup } from '@crefle/web-ui';

import type { LocationView } from './types';

/**
 * 적치 위치를 **상위 위치 기준 1단 그룹**으로 접는다.
 *
 * 착수 이슈는 「창고 아래 위치를 그룹으로 묶으면 된다」고 적었으나 **그 형태는 계약이
 * 허락하지 않는다** — `GET /mdm/locations`가 `warehouseId`를 필수 쿼리로 요구해(실측)
 * 창고 여럿의 위치를 한 선택칸에 담으려면 창고 수만큼 요청해야 한다. 그리고 창고는 요청
 * 헤더의 별도 필수 필드라 어차피 선택칸이 따로 있어야 한다. **한 창고의 위치만 담기는
 * 선택칸에서 창고로 묶으면 그룹이 늘 하나뿐이라 뜻이 없다.**
 *
 * 그래서 묶는 기준은 **상위 위치**다. 위치는 자기참조 계층이고(계약 실측) 디자인 시스템
 * `Select`는 **1단 그룹만** 지원하므로, 3단 이상이면 **직속 상위**를 그룹 라벨로 쓴다 —
 * 최상위로 올려 붙이면 서로 다른 자리가 한 자리처럼 읽힌다.
 *
 * **모르는 것을 묶지 않는다.** 상위 번호는 있는데 그 상위가 목록에 없으면(잘렸거나 사용
 * 중지됐다) 그 위치를 평면으로 둔다 — 모르는 상위끼리 한 그룹으로 모으면 서로 다른 자리가
 * 같은 자리처럼 보이고, 그룹 이름을 지어내면 없는 자리 이름이 화면에 생긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 평면 선택지와 1단 그룹이 섞인 목록. 디자인 시스템 `Select`가 그대로 받는다. */
export type LocationSelectItem = SelectOption | SelectOptionGroup;

/** 그룹인가. `Select`가 둘을 한 배열에 받으므로 읽는 쪽이 가릴 수단이 필요하다. */
export const isLocationGroup = (
  item: LocationSelectItem | undefined,
): item is SelectOptionGroup => item !== undefined && 'options' in item;

/** 「코드 · 이름」. 위치 이름만으로는 같은 이름이 창고마다 있을 수 있어 코드를 앞세운다. */
const labelOf = (location: LocationView): string =>
  `${location.locationCode} · ${location.locationName}`;

/**
 * 이 위치를 묶을 상위. **묶을 수 없으면 `null`이다.**
 *
 * 자기 자신을 상위로 가리키는 행이 실제로 온다(목 서버 실측). 그대로 접으면 자기 이름의
 * 그룹 안에 자기가 들어가므로 상위가 없는 것으로 본다.
 */
const groupParentOf = (
  location: LocationView,
  byId: ReadonlyMap<number, LocationView>,
): LocationView | null => {
  const parentId = location.parentLocationId;

  if (parentId === null || parentId === location.locationId) return null;

  return byId.get(parentId) ?? null;
};

export const toLocationOptions = (locations: readonly LocationView[]): LocationSelectItem[] => {
  const byId = new Map(locations.map((location) => [location.locationId, location]));

  const items: LocationSelectItem[] = [];
  /* 같은 상위의 둘째 항목이 새 그룹을 만들지 않게 이미 만든 그룹을 붙들어 둔다. */
  const groupByParentId = new Map<number, SelectOptionGroup>();

  for (const location of locations) {
    const option: SelectOption = { value: String(location.locationId), label: labelOf(location) };
    const parent = groupParentOf(location, byId);

    if (parent === null) {
      items.push(option);
      continue;
    }

    const existing = groupByParentId.get(parent.locationId);

    if (existing !== undefined) {
      existing.options.push(option);
      continue;
    }

    /* 그룹은 **첫 항목이 나온 자리**에 선다 — 응답 차례가 뜻일 수 있어 흩뜨리지 않는다. */
    const group: SelectOptionGroup = { label: labelOf(parent), options: [option] };

    groupByParentId.set(parent.locationId, group);
    items.push(group);
  }

  return items;
};
