import { messages } from '@omf-mes/i18n';

import type { LookupEntry, UserRole } from './types';

/**
 * 역할 부여의 초안과 치환 본문.
 *
 * **전체 치환이다.** 확인칸 하나를 켤 때마다 서버를 부르지 않고, 「저장」에서 최종 상태를
 * 통째로 보낸다 — 계약이 개별 부여·회수 경로를 두지 않았다.
 *
 * **화면이 「이 역할은 특별하다」를 판정하지 않는다**(계획 결정 4). 여기서 확인칸이 잠기는
 * 이유는 오직 하나 — 그 역할이 **미사용**이라는 사실뿐이다. 무엇을 줄 수 있고 무엇을 뺄 수
 * 없는지는 서버가 정하며, 화면은 그 거부를 옮기는 데까지다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.usersRoles;

/** 치환 요청 본문. **식별자는 역할 번호뿐이다** — `userRoleId`도 `appUserId`도 담지 않는다. */
export interface RolesPayload {
  roleIds: number[];
}

/** 확인칸 하나가 아는 것. 화면은 이 목록만 보고 그린다. */
export interface RoleChoice {
  roleId: number;
  /** 「역할코드 · 역할명」. 미사용이면 표식이 붙는다 */
  label: string;
  isSelected: boolean;
  /**
   * 새로 켜고 끌 수 없다. **미사용 역할에만 붙는다** —
   * 「자기 자신」·「마지막 한 사람」 같은 판정을 화면이 하지 않는다(계획 결정 4).
   */
  isLocked: boolean;
}

/**
 * 서버가 준 부여분에서 초안을 세운다.
 *
 * **역할 번호만 들고 다닌다.** 계약의 치환 본문이 `roleIds`뿐이라 나머지(`userRoleId`·`appUserId`)는
 * 되돌아 나갈 자리가 없다 — 들고 있으면 언젠가 실린다.
 */
export const toRoleAssignDraft = (items: readonly UserRole[]): number[] =>
  items.map((item) => item.roleId);

/** 확인칸 하나를 켜고 끈다. 원본을 고치지 않는다 — 기준값이 함께 흔들리면 안 된다. */
export const toggleRoleId = (selected: readonly number[], roleId: number): number[] =>
  selected.includes(roleId)
    ? selected.filter((current) => current !== roleId)
    : [...selected, roleId];

/**
 * 「고친 것이 있는가」의 판정 근거.
 *
 * **순서를 보지 않는다.** 체크 순서는 자료가 아니라 조작의 흔적이라, 순서로 판정하면
 * 켰다가 되돌려 놓아도 「고쳤다」로 남아 취소·저장이 사실과 어긋난다.
 */
export const isSameRoleSelection = (a: readonly number[], b: readonly number[]): boolean => {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((roleId) => right.has(roleId));
};

/** 선택 목록이 준 순서. 치환 본문의 순서를 정하는 유일한 근거다. */
export const roleCatalogOrder = (entries: readonly LookupEntry[]): number[] =>
  entries.map((entry) => Number(entry.value));

/**
 * 확인칸 목록.
 *
 * 사용 중인 역할은 전부 나온다. **미사용 역할은 이미 부여돼 있을 때만 남기고 잠근다** —
 * 빼 버리면 저장할 때 그 부여가 조용히 회수되고, 열어 두면 쓰지 않기로 한 역할을 새로 줄 수 있다.
 */
export const toRoleChoices = (
  entries: readonly LookupEntry[],
  selected: readonly number[],
): RoleChoice[] => {
  const chosen = new Set(selected);

  return entries
    .map((entry) => {
      const roleId = Number(entry.value);

      return {
        roleId,
        label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
        isSelected: chosen.has(roleId),
        isLocked: !entry.isActive,
      };
    })
    .filter((choice) => !choice.isLocked || choice.isSelected);
};

/**
 * 치환 요청 본문.
 *
 * **최종 상태 전체를 싣는다.** 바뀐 것만 실으면 나머지가 전부 회수된다 — 계약이 전체 치환이다.
 *
 * 순서는 **선택 목록이 준 순서**다. 사용자가 체크한 순서로 실으면 같은 선택에서 매번 다른
 * 본문이 나가 캐시도 테스트도 흔들린다.
 *
 * **선택 목록에 없는 부여분도 싣는다.** 목록이 잘리면 부여된 역할이 화면에 나타나지 않을 수
 * 있는데, 그때 목록에 있는 것만 실으면 **보여 준 적도 없는 부여가 저장할 때 조용히 사라진다.**
 */
export const toRolesPayload = (
  selectedRoleIds: readonly number[],
  catalogOrder: readonly number[],
): RolesPayload => {
  const selected = new Set(selectedRoleIds);
  const emitted = new Set<number>();
  const roleIds: number[] = [];

  const push = (roleId: number): void => {
    if (emitted.has(roleId)) return;

    emitted.add(roleId);
    roleIds.push(roleId);
  };

  for (const roleId of catalogOrder) {
    if (selected.has(roleId)) push(roleId);
  }

  for (const roleId of selectedRoleIds) push(roleId);

  return { roleIds };
};
