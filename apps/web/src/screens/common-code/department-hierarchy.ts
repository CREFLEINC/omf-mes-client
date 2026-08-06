import type { DepartmentRow, LookupEntry } from './types';

/**
 * 부서 계층 판정. 순수 함수만 둔다 — 목록 그룹·3단 안내·상위 선택지가 모두 이것을 쓴다.
 *
 * **자기참조 접기는 여기서 하지 않는다.** 계약→화면 변환(`department-mappers.ts`)이 한 번만 접고
 * 이 파일은 접힌 뒤의 값만 다룬다 — 규칙이 두 곳에 생기면 반드시 한쪽이 어긋난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 상위를 찾을 수 없는 행이 모이는 그룹. 빈 문자열을 쓰지 않는다 —
 * 디자인 시스템 `Table`이 빈 그룹 키를 빈 머리글로 그대로 렌더한다.
 */
export const ORPHAN_GROUP_KEY = '__orphan__';

export const indexById = (rows: readonly DepartmentRow[]): Map<number, DepartmentRow> =>
  new Map(rows.map((row) => [row.departmentId, row]));

/**
 * 로캘에 따라 결과가 달라지지 않도록 `localeCompare` 대신 단순 문자열 비교를 쓴다.
 * 정렬 결과가 실행 환경마다 달라지면 표의 순서와 테스트가 어긋난다.
 */
const byCode = (a: DepartmentRow, b: DepartmentRow): number => {
  if (a.departmentCode < b.departmentCode) return -1;
  if (a.departmentCode > b.departmentCode) return 1;
  return 0;
};

/**
 * 이 행이 속할 그룹의 키.
 *
 * 상위가 또 상위를 갖는 행(3단 이상)도 **자기 상위의 그룹에 그대로** 넣는다 —
 * 표시를 위해 계층을 다시 계산하면 서버에 있는 관계와 화면이 어긋난다.
 *
 * 상위를 이 쪽 목록에서 찾을 수 없으면 고아 그룹이다. 쪽 나눔 때문에 상위가 다른 쪽에
 * 있을 수 있으므로 「없다」를 「뿌리다」로 읽지 않는다.
 */
export const groupKeyOf = (
  row: DepartmentRow,
  byId: ReadonlyMap<number, DepartmentRow>,
): string => {
  if (row.parentDepartmentId === null) return String(row.departmentId);

  return byId.has(row.parentDepartmentId) ? String(row.parentDepartmentId) : ORPHAN_GROUP_KEY;
};

/**
 * 표에 넘길 행 순서를 정한다.
 *
 * 디자인 시스템 `Table`의 그룹 순서는 `rows` 배열에서 그 그룹 키가 **처음 나온 순서**다.
 * 그래서 화면이 미리 정렬해 넘겨야 한다.
 * - 그룹은 대표 부서의 부서코드 오름차순, 고아 그룹은 맨 뒤
 * - 그룹 안에서는 대표 부서가 첫 행이고 이어서 하위가 부서코드 오름차순
 */
export const orderForGrouping = (
  rows: readonly DepartmentRow[],
  byId: ReadonlyMap<number, DepartmentRow>,
): DepartmentRow[] => {
  const groups = new Map<string, DepartmentRow[]>();

  for (const row of rows) {
    const key = groupKeyOf(row, byId);
    const members = groups.get(key);

    if (members === undefined) {
      groups.set(key, [row]);
    } else {
      members.push(row);
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
    // 그룹을 대표하는 부서가 자기 그룹의 첫 행이다 — 상위 부서 자신도 고를 수 있어야 한다.
    const headIndex = members.findIndex((row) => String(row.departmentId) === key);
    if (headIndex <= 0) return members;

    const head = members[headIndex];
    return head === undefined
      ? members
      : [head, ...members.filter((_row, index) => index !== headIndex)];
  });
};

/**
 * 상위가 뿌리가 아닌 행이 있는가 — 곧 3단 이상 계층이다.
 *
 * 이슈 §6이 「실제로 더 깊으면 목록 그룹 표시로는 부족합니다」라고 예고한 상태이며,
 * 화면은 그것을 감추지 않고 안내로 낸다. **상위를 찾을 수 없는 행(고아)은 깊이를 알 수 없으므로
 * 3단으로 세지 않는다** — 고아라는 사실은 그 그룹 머리글이 따로 밝힌다.
 */
export const hasDeepHierarchy = (
  rows: readonly DepartmentRow[],
  byId: ReadonlyMap<number, DepartmentRow>,
): boolean =>
  rows.some((row) => {
    if (row.parentDepartmentId === null) return false;

    const parent = byId.get(row.parentDepartmentId);
    return parent !== undefined && parent.parentDepartmentId !== null;
  });

/**
 * 상위로 고를 수 있는 후보.
 *
 * **자기 자신만 뺀다.** 계약의 `ck_department_parent`가 자기 자신을 막으므로 어차피 거부당할 값을
 * 고르게 두지 않는다.
 *
 * **후손은 남긴다 — 순환(A→B→A)을 화면이 막지 않는다.** 계약이 그 검사를 서버 소관으로 명시했고,
 * 화면이 흉내 내면 서버와 다른 답을 낸다. 서버가 400을 주면 그 사유를 배너로 낸다.
 *
 * **좌 목록이 아니라 전체 목록(선택지 조회)을 받는다** — 쪽 나눔 때문에 상위 부서가 다른 쪽에
 * 있을 수 있어 보이는 행만으로는 고를 수 없다. 그래서 입력이 계층 행이 아니라 선택지 항목이다.
 *
 * 미사용 여부는 거르지 않는다 — 「지금 고른 값은 남긴다」는 표시 규칙을 선택지 쪽이 정한다.
 * 정렬은 선택지 문구(`부서코드 · 부서명`) 오름차순이라 결과적으로 부서코드 순이다.
 */
export const parentOptionsFor = (
  entries: readonly LookupEntry[],
  editingDepartmentId: number | null,
): LookupEntry[] =>
  entries
    .filter((entry) => entry.value !== String(editingDepartmentId))
    .sort((a, b) => {
      if (a.label < b.label) return -1;
      if (a.label > b.label) return 1;
      return 0;
    });
