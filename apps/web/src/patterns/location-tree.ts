import type { components } from '@omf-mes/api-client';

type Location = components['schemas']['Location'];

/**
 * 위치 계층 — 창고·Location 의 Location 목록과 창고 배치도의 위치 목록이 같은 계층을 그린다(사용자 지시 2026-10-30).
 * 평탄화 · 처음 펼칠 노드 · 코드 순서 · 보이는 이름을 여기 한 벌로 둔다. 칸 모양은 `location-tree-cell.tsx`.
 */

/**
 * 코드 순서 — 숫자를 수로 읽는다. 랙 `R100` 이 `R99` 뒤에, 자리 수가 섞인 옛 코드도 차례대로 놓인다.
 * 로캘을 `en` 으로 묶어 실행 환경마다 순서가 달라지지 않게 한다.
 */
export const compareLocationCodes = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** 위치를 사람에게 부르는 이름 — 별칭이 이름이다(사용자 지시 2026-10-29). 별칭이 없으면 저장된 위치명. */
export const locationShownName = (location: Pick<Location, 'locationName' | 'aliasName'>): string =>
  location.aliasName?.trim() || location.locationName;

/** 부모가 없거나 · 자기 자신이거나 · 목록에 없으면 최상위다 — `buildLocationRows` 와 같은 판정. */
const parentInList = (item: Location, known: ReadonlySet<number>): number | null => {
  const parentId = item.parentLocationId;
  return parentId === null ||
    parentId === undefined ||
    parentId === item.locationId ||
    !known.has(parentId)
    ? null
    : parentId;
};

/** 하위를 가진 노드 전부 — 전체 펼치기가 이것을 펼친다. */
export const parentLocationIds = (items: readonly Location[]): Set<number> => {
  const known = new Set(items.map((item) => item.locationId));
  const parents = new Set<number>();
  for (const item of items) {
    const parentId = parentInList(item, known);
    if (parentId !== null) parents.add(parentId);
  }
  return parents;
};

/**
 * 처음 펼칠 노드 — 맨 위(구역)만 펼쳐 랙까지 보인다. 랙이 백 개를 넘으면 층 · 셀까지 다 펼친 표는 수천 행이 된다
 * (사용자 지시 2026-10-29). `all` 이면(검색 중) 찾은 위치가 묻히지 않게 하위를 가진 노드를 다 펼친다.
 */
export const initialExpandedLocationIds = (
  items: readonly Location[],
  all = false,
): Set<number> => {
  if (all) return parentLocationIds(items);
  const known = new Set(items.map((item) => item.locationId));
  const rootIds = new Set(
    items.filter((item) => parentInList(item, known) === null).map((item) => item.locationId),
  );
  return new Set([...parentLocationIds(items)].filter((id) => rootIds.has(id)));
};

export interface LocationTreeRow {
  location: Location;
  depth: number;
  hasChildren: boolean;
}

/** 숫자를 수로 읽는 코드 순서 — 랙 `R100` 이 `R99` 뒤에 놓인다. 로캘은 고정이라 환경마다 같다. */
const byLocationCode = (a: Location, b: Location): number =>
  compareLocationCodes(a.locationCode, b.locationCode);

/**
 * Location 계층을 표에 그릴 수 있게 깊이 우선으로 평탄화한다.
 *
 * - 형제는 locationCode 오름차순(숫자는 수로 읽는다)
 * - 접힌 노드(expandedIds에 없는 노드)의 하위는 결과에서 빠지지만 hasChildren은 그대로 참
 * - 부모가 없거나 자기 자신인 항목, 부모가 목록에 없는 고아는 최상위로 올려 반드시 노출한다
 * - 부모-자식 순환이 있어도 무한 루프에 빠지지 않고 모든 항목이 정확히 한 번씩 나온다
 */
export const buildLocationRows = (
  items: readonly Location[],
  expandedIds: ReadonlySet<number>,
): LocationTreeRow[] => {
  const byId = new Map<number, Location>(items.map((item) => [item.locationId, item]));

  const childrenOf = new Map<number, Location[]>();
  const roots: Location[] = [];

  for (const item of items) {
    const parentId = item.parentLocationId;
    /*
     * 부모가 없거나, 자기 자신이거나, 목록에 없으면(고아) 최상위로 올린다.
     * 자기참조를 부모-자식으로 세면 하위가 없는데도 「하위 접기」가 붙어 누를 것이 없는 컨트롤이 생긴다.
     */
    if (
      parentId === null ||
      parentId === undefined ||
      parentId === item.locationId ||
      !byId.has(parentId)
    ) {
      roots.push(item);
      continue;
    }
    const siblings = childrenOf.get(parentId);
    if (siblings) {
      siblings.push(item);
    } else {
      childrenOf.set(parentId, [item]);
    }
  }

  for (const siblings of childrenOf.values()) {
    siblings.sort(byLocationCode);
  }

  // 접힘과 무관하게 최상위에서 구조적으로 닿는 항목을 먼저 가린다.
  // 순환에 갇혀 어디서도 닿지 못하는 항목만 추가 최상위로 올려야 하며,
  // 단지 접혀서 안 보이는 하위를 최상위로 끌어올리면 안 된다.
  const reachable = new Set<number>();
  const markReachable = (location: Location): void => {
    if (reachable.has(location.locationId)) return;
    reachable.add(location.locationId);
    for (const child of childrenOf.get(location.locationId) ?? []) {
      markReachable(child);
    }
  };
  for (const root of roots) {
    markReachable(root);
  }

  const orderedRoots = [...roots, ...items.filter((item) => !reachable.has(item.locationId))].sort(
    byLocationCode,
  );

  const rows: LocationTreeRow[] = [];
  const visited = new Set<number>();

  const visit = (location: Location, depth: number): void => {
    if (visited.has(location.locationId)) return;
    visited.add(location.locationId);

    const children = childrenOf.get(location.locationId) ?? [];
    rows.push({ location, depth, hasChildren: children.length > 0 });

    if (!expandedIds.has(location.locationId)) return;
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  for (const root of orderedRoots) {
    visit(root, 0);
  }

  return rows;
};
