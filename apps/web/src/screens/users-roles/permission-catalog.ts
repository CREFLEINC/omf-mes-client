import type { RolePermission } from './types';

/**
 * 기능 권한 격자의 **열 구성**.
 *
 * 권한 목록이 확정되지 않았다 — 어떤 권한이 있는지, 메뉴 단위인지 조작 단위인지가
 * 정해지지 않은 상태다(이슈 #17 §4). 그래서 이 모듈은 **값을 하나도 갖지 않는다.**
 *
 * 격자는 그리되 누를 수 없고, 여기서 만드는 열은 **서버가 준 부여분**에서만 나온다.
 * 확정되면 아래 상수에 코드를 채우는 것으로 열이 늘고 「부여되지 않은 칸」이 드러난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 확정되면 채울 자리. **지금은 비어 있어야 한다.**
 *
 * 예시로라도 코드값을 적으면 화면이 「이 역할에는 그 권한이 없다」는 **없는 사실을 단정한다** —
 * 부여되지 않은 것이 아니라 그런 권한이 있는지조차 아직 모른다.
 */
export const PLACEHOLDER_PERMISSION_CODES: readonly string[] = [];

/** 격자의 열 하나. 행이 고른 역할 하나뿐이라 부여 여부도 열마다 하나씩이다. */
export interface PermissionColumn {
  /** 권한 코드 그대로. 이름 목록이 없어 옮길 표기가 없다 */
  code: string;
  isGranted: boolean;
}

/**
 * 자리표시 ∪ **이 역할에 부여된 코드**로 열을 만든다.
 *
 * 자리표시가 앞이고 거기 없는 부여분이 뒤에 붙는다 — 부여분을 빼면 사용자가 실제로 가진 권한이
 * 화면에서 사라진다. 같은 코드가 두 번 와도 열은 하나다.
 *
 * `placeholderCodes`를 인자로 둔 것은 **확정 전의 동작을 확인할 수 있게** 하기 위해서다.
 * 상수가 빈 배열인 동안에는 「부여되지 않은 열」이 생길 수 없어 그 갈래를 밟을 방법이 없다.
 */
export const toPermissionColumns = (
  items: readonly RolePermission[],
  placeholderCodes: readonly string[] = PLACEHOLDER_PERMISSION_CODES,
): PermissionColumn[] => {
  const granted = new Set(items.map((item) => item.permissionCode));
  const codes = [...placeholderCodes];

  for (const code of granted) {
    if (!codes.includes(code)) codes.push(code);
  }

  return codes.map((code) => ({ code, isGranted: granted.has(code) }));
};
