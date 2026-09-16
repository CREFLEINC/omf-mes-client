import type { PermissionColumn } from './permission-catalog';
import type { RolePermission } from './types';

/**
 * 기능 권한 부여의 초안과 치환 본문.
 *
 * **전체 치환이다.** 칸 하나를 켤 때마다 서버를 부르지 않고 「저장」에서 최종 상태를 통째로
 * 보낸다 — 계약이 개별 부여·회수 경로를 두지 않았다(`PUT /app/roles/{roleId}/permissions`).
 *
 * **화면이 「이 권한은 특별하다」를 판정하지 않는다.** 마지막 관리자인지, 자기 자신인지는
 * **그 권한 보유자 수**로 갈리는데 화면에는 그 수를 셀 근거가 하나도 없다. 서버가
 * `code=LAST_ADMIN` 으로 거부하고 화면은 그 거부를 옮기는 데까지다.
 *
 * 역할 부여(`role-assign-draft.ts`)와 같은 규약이다 — 같은 화면 안에서 저장 규칙이 갈리지 않게 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 치환 요청 본문. **식별자는 권한 코드뿐이다** — `rolePermissionId` 도 `roleId` 도 담지 않는다. */
export interface PermissionsPayload {
  permissionCodes: string[];
}

/** 서버가 준 부여분에서 초안을 세운다. 코드만 들고 다닌다 — 본문에 실리는 것이 그것뿐이다. */
export const toPermissionDraft = (items: readonly RolePermission[]): string[] =>
  items.map((item) => item.permissionCode);

/** 칸 하나를 켜고 끈다. 원본을 고치지 않는다 — 기준값이 함께 흔들리면 안 된다. */
export const togglePermissionCode = (selected: readonly string[], code: string): string[] =>
  selected.includes(code) ? selected.filter((current) => current !== code) : [...selected, code];

/**
 * 「고친 것이 있는가」의 판정 근거.
 *
 * **순서를 보지 않는다.** 체크 순서는 자료가 아니라 조작의 흔적이라, 순서로 판정하면
 * 켰다가 되돌려 놓아도 「고쳤다」로 남아 취소·저장이 사실과 어긋난다.
 */
export const isSamePermissionSelection = (a: readonly string[], b: readonly string[]): boolean => {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((code) => right.has(code));
};

/** 격자가 그린 차례. 치환 본문의 차례를 정하는 유일한 근거다. */
export const permissionCatalogOrder = (columns: readonly PermissionColumn[]): string[] =>
  columns.map((column) => column.code);

/**
 * 치환 요청 본문.
 *
 * **최종 상태 전체를 싣는다.** 바뀐 것만 실으면 나머지가 전부 회수된다 — 계약이 전체 치환이다.
 *
 * 차례는 **격자가 그린 차례**다. 사용자가 체크한 차례로 실으면 같은 선택에서 매번 다른 본문이
 * 나가 캐시도 시험도 흔들린다.
 *
 * **격자에 없는 부여분도 싣는다.** 후보 조회가 잘리거나 실패하면 부여된 권한이 열로 서지 않을
 * 수 있는데, 그때 격자에 있는 것만 실으면 **보여 준 적도 없는 부여가 저장할 때 조용히 사라진다.**
 * 서버가 후보 밖 코드를 400 으로 거부하더라도, 조용한 회수보다 눈에 보이는 거부가 낫다.
 */
export const toPermissionsPayload = (
  selectedCodes: readonly string[],
  catalogOrder: readonly string[],
): PermissionsPayload => {
  const selected = new Set(selectedCodes);
  const emitted = new Set<string>();
  const permissionCodes: string[] = [];

  const push = (code: string): void => {
    if (emitted.has(code)) return;

    emitted.add(code);
    permissionCodes.push(code);
  };

  for (const code of catalogOrder) {
    if (selected.has(code)) push(code);
  }

  for (const code of selectedCodes) push(code);

  return { permissionCodes };
};
