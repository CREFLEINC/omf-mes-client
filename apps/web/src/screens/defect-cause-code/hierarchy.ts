import type { HierarchyCode } from './types';

/**
 * 2계층 판정. 순수 함수만 둔다 — 목록 그룹·상위 선택지·저장 차단·하위 건수가 모두 이것을 쓴다.
 *
 * 자기참조 접기는 여기서 하지 않는다. 계약→화면 변환(`mappers.ts`)이 한 번만 접고,
 * 이 파일은 접힌 뒤의 값만 다룬다 — 규칙이 두 곳에 생기면 반드시 한쪽이 어긋난다.
 */

/**
 * 상위를 찾을 수 없는 행이 모이는 그룹. 빈 문자열을 쓰지 않는다 —
 * 디자인 시스템 `Table`이 빈 그룹 키를 빈 머리글로 그대로 렌더한다.
 */
export const ORPHAN_GROUP_KEY = '__orphan__';

export const isCategory = (item: HierarchyCode): boolean => item.parentId === null;

export const indexById = (items: readonly HierarchyCode[]): Map<number, HierarchyCode> =>
  new Map(items.map((item) => [item.id, item]));

/**
 * 로캘에 따라 결과가 달라지지 않도록 `localeCompare` 대신 단순 문자열 비교를 쓴다.
 * 정렬 결과가 실행 환경마다 달라지면 표의 순서와 테스트가 어긋난다.
 */
const byCode = (a: HierarchyCode, b: HierarchyCode): number => {
  if (a.code < b.code) return -1;
  if (a.code > b.code) return 1;
  return 0;
};

/**
 * 이 행이 속할 그룹의 키.
 *
 * 상위가 상세 코드인 경우(이미 3계층인 기존 데이터)에도 그 상위의 그룹에 그대로 넣는다 —
 * 표시를 위해 계층을 다시 계산하면 서버에 있는 관계와 화면이 어긋난다.
 */
export const groupKeyOf = (
  item: HierarchyCode,
  byId: ReadonlyMap<number, HierarchyCode>,
): string => {
  if (item.parentId === null) return String(item.id);
  return byId.has(item.parentId) ? String(item.parentId) : ORPHAN_GROUP_KEY;
};

/**
 * 표에 넘길 행 순서를 정한다.
 *
 * 디자인 시스템 `Table`의 그룹 순서는 `rows` 배열에서 그 그룹 키가 **처음 나온 순서**다.
 * 그래서 화면이 미리 정렬해 넘겨야 한다.
 * - 그룹은 그 그룹을 대표하는 코드의 코드값 오름차순, 고아 그룹은 맨 뒤
 * - 그룹 안에서는 대표 코드가 첫 행이고 이어서 상세 코드가 코드값 오름차순
 */
export const orderForGrouping = (
  items: readonly HierarchyCode[],
  byId: ReadonlyMap<number, HierarchyCode>,
): HierarchyCode[] => {
  const groups = new Map<string, HierarchyCode[]>();

  for (const item of items) {
    const key = groupKeyOf(item, byId);
    const members = groups.get(key);

    if (members === undefined) {
      groups.set(key, [item]);
    } else {
      members.push(item);
    }
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === ORPHAN_GROUP_KEY) return 1;
    if (b === ORPHAN_GROUP_KEY) return -1;

    const left = byId.get(Number(a));
    const right = byId.get(Number(b));
    if (left === undefined || right === undefined) return 0;
    return byCode(left, right);
  });

  return orderedKeys.flatMap((key) => {
    const members = [...(groups.get(key) ?? [])].sort(byCode);
    // 그룹을 대표하는 코드가 자기 그룹의 첫 행이다 — 대분류 자신을 고를 수 있어야 한다.
    const headIndex = members.findIndex((item) => String(item.id) === key);
    if (headIndex <= 0) return members;

    const head = members[headIndex];
    return head === undefined
      ? members
      : [head, ...members.filter((_item, index) => index !== headIndex)];
  });
};

export const childCountOf = (items: readonly HierarchyCode[], id: number): number =>
  items.filter((item) => item.parentId === id).length;

export const hasChildren = (items: readonly HierarchyCode[], id: number): boolean =>
  items.some((item) => item.parentId === id);

/**
 * 상위로 고를 수 있는 후보. 차단 규칙 R1(자기 자신 금지)·R2(대분류만)의 1차 방어다.
 * 미사용 여부는 거르지 않는다 — 「지금 선택된 값은 남긴다」는 표시 규칙을 화면이 정한다.
 */
export const categoryOptionsFor = (
  items: readonly HierarchyCode[],
  editingId: number | null,
): HierarchyCode[] =>
  items.filter((item) => isCategory(item) && item.id !== editingId).sort(byCode);
