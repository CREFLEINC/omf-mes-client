import type { Location } from './types';

export interface LocationTreeRow {
  location: Location;
  depth: number;
  hasChildren: boolean;
}

/**
 * 로캘에 따라 결과가 달라지지 않도록 localeCompare 대신 단순 문자열 비교를 쓴다.
 * 정렬 결과가 실행 환경마다 달라지면 표의 순서와 테스트가 어긋난다.
 */
const byLocationCode = (a: Location, b: Location): number => {
  if (a.locationCode < b.locationCode) return -1;
  if (a.locationCode > b.locationCode) return 1;
  return 0;
};

/**
 * Location 계층을 표에 그릴 수 있게 깊이 우선으로 평탄화한다.
 *
 * - 형제는 locationCode 오름차순
 * - 접힌 노드(expandedIds에 없는 노드)의 하위는 결과에서 빠지지만 hasChildren은 그대로 참
 * - 부모가 없거나 자기 자신인 항목, 부모가 목록에 없는 고아는 최상위로 올려 반드시 노출한다
 * - 부모-자식 순환이 있어도 무한 루프에 빠지지 않고 모든 항목이 정확히 한 번씩 나온다
 */
export const buildLocationRows = (
  items: Location[],
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

  const orderedRoots = [
    ...roots,
    ...items.filter((item) => !reachable.has(item.locationId)),
  ].sort(byLocationCode);

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
