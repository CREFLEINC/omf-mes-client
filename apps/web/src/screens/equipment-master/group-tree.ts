import type { EquipmentGroup } from './types';

export interface GroupTreeRow {
  group: EquipmentGroup;
  depth: number;
  hasChildren: boolean;
}

/**
 * 로캘에 따라 결과가 달라지지 않도록 localeCompare 대신 단순 문자열 비교를 쓴다.
 * 정렬 결과가 실행 환경마다 달라지면 표의 순서와 테스트가 어긋난다.
 */
const byGroupCode = (a: EquipmentGroup, b: EquipmentGroup): number => {
  if (a.groupCode < b.groupCode) return -1;
  if (a.groupCode > b.groupCode) return 1;
  return 0;
};

/**
 * 설비 그룹 계층을 표에 그릴 수 있게 깊이 우선으로 평탄화한다.
 *
 * - 형제는 groupCode 오름차순
 * - 접힌 노드(expandedIds에 없는 노드)의 하위는 결과에서 빠지지만 hasChildren은 그대로 참
 * - 부모가 없거나 자기 자신인 항목, 부모가 목록에 없는 고아는 최상위로 올려 반드시 노출한다
 * - 부모-자식 순환이 있어도 무한 루프에 빠지지 않고 모든 항목이 정확히 한 번씩 나온다
 *
 * ⚠ **순환은 실제로 들어올 수 있다.** 데이터베이스가 막는 것은 직계 자기참조뿐이고
 * A→B→A 는 막지 않는다(화면 스펙 §8-4). 「있을 수 없다」로 두면 화면이 멈춘다.
 */
export const buildGroupRows = (
  items: EquipmentGroup[],
  expandedIds: ReadonlySet<number>,
): GroupTreeRow[] => {
  const byId = new Map<number, EquipmentGroup>(items.map((item) => [item.equipmentGroupId, item]));

  const childrenOf = new Map<number, EquipmentGroup[]>();
  const roots: EquipmentGroup[] = [];

  for (const item of items) {
    const parentId = item.parentGroupId;
    /*
     * 부모가 없거나, 자기 자신이거나, 목록에 없으면(고아) 최상위로 올린다.
     * 자기참조를 부모-자식으로 세면 하위가 없는데도 「하위 접기」가 붙어 누를 것이 없는 컨트롤이 생긴다.
     */
    if (
      parentId === null ||
      parentId === undefined ||
      parentId === item.equipmentGroupId ||
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
    siblings.sort(byGroupCode);
  }

  // 접힘과 무관하게 최상위에서 구조적으로 닿는 항목을 먼저 가린다.
  // 순환에 갇혀 어디서도 닿지 못하는 항목만 추가 최상위로 올려야 하며,
  // 단지 접혀서 안 보이는 하위를 최상위로 끌어올리면 안 된다.
  const reachable = new Set<number>();
  const markReachable = (group: EquipmentGroup): void => {
    if (reachable.has(group.equipmentGroupId)) return;
    reachable.add(group.equipmentGroupId);
    for (const child of childrenOf.get(group.equipmentGroupId) ?? []) {
      markReachable(child);
    }
  };
  for (const root of roots) {
    markReachable(root);
  }

  const orderedRoots = [
    ...roots,
    ...items.filter((item) => !reachable.has(item.equipmentGroupId)),
  ].sort(byGroupCode);

  const rows: GroupTreeRow[] = [];
  const visited = new Set<number>();

  const visit = (group: EquipmentGroup, depth: number): void => {
    if (visited.has(group.equipmentGroupId)) return;
    visited.add(group.equipmentGroupId);

    const children = childrenOf.get(group.equipmentGroupId) ?? [];
    rows.push({ group, depth, hasChildren: children.length > 0 });

    if (!expandedIds.has(group.equipmentGroupId)) return;
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  for (const root of orderedRoots) {
    visit(root, 0);
  }

  return rows;
};

/**
 * 어떤 그룹의 **자기 자신과 모든 후손** 식별자.
 *
 * 상위 그룹 선택지에서 이 집합을 빼면 순환(A→B→A)이 만들어지지 않는다.
 * 데이터베이스는 **직계 자기참조만** 막으므로 나머지는 화면과 서버가 함께 진다(스펙 §8-4).
 *
 * ⚠ **이미 순환이 들어 있는 자료에서도 멈추지 않는다** — 방문한 노드를 다시 밟지 않는다.
 * 순환은 「있을 수 없는 것」이 아니라 실제로 내려올 수 있는 값이다.
 */
export const selfAndDescendantIds = (
  items: EquipmentGroup[],
  groupId: number,
): ReadonlySet<number> => {
  const childrenOf = new Map<number, number[]>();

  for (const item of items) {
    const parentId = item.parentGroupId;
    if (parentId === null || parentId === undefined || parentId === item.equipmentGroupId) continue;
    const siblings = childrenOf.get(parentId);
    if (siblings) {
      siblings.push(item.equipmentGroupId);
    } else {
      childrenOf.set(parentId, [item.equipmentGroupId]);
    }
  }

  const blocked = new Set<number>();
  const walk = (id: number): void => {
    if (blocked.has(id)) return;
    blocked.add(id);
    for (const childId of childrenOf.get(id) ?? []) {
      walk(childId);
    }
  };
  walk(groupId);

  return blocked;
};
