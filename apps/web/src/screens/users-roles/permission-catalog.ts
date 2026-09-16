import { messages } from '@omf-mes/i18n';

import type { Permission } from './types';

/**
 * 기능 권한 격자의 **열 구성**.
 *
 * 열은 `GET /app/permissions` 가 주는 **부여할 수 있는 후보 전부**에서 나온다. 종전에는 이
 * 모듈이 값을 하나도 갖지 않았는데, 그때는 후보를 주는 경로가 계약에 없어 「이미 부여된 것」
 * 밖에 알 수 없었다 — 부여가 0건인 역할은 격자가 통째로 비고 아무도 아무 권한을 받지 못했다.
 *
 * ⛔ **자리표시 상수를 두지 않는다.** 후보 목록이 정본이라 화면이 코드를 지어낼 자리가 없다.
 *
 * ⛔ **열 이름을 화면이 만들지 않는다** — 서버가 준 `name` 을 그대로 쓴다(계약 `Permission.name`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.usersRoles;

/** 격자의 열 하나. 행이 고른 역할 하나뿐이라 부여 여부도 열마다 하나씩이다. */
export interface PermissionColumn {
  /** 권한 코드. 저장 본문에 그대로 실린다 */
  code: string;
  /** 열 머리에 보일 이름. 서버가 준 것이거나, 후보에 없으면 코드 그대로 */
  label: string;
  isGranted: boolean;
  /**
   * **후보 목록에 없는데 부여돼 있는 열.**
   *
   * 서버가 치환에서 후보 밖 코드를 400 으로 거부하므로 정상적으로는 생기지 않는다. 생겼다면
   * 후보 목록과 부여분이 어긋난 것이고, 그 사실을 **감추지 않는다** — 열을 빼면 사용자가 실제로
   * 가진 권한이 화면에서 사라지고, 그 상태로 저장하면 조용히 회수된다.
   */
  isUnlisted: boolean;
}

/**
 * 열 묶음 하나. 격자를 도메인 축으로 가른다.
 *
 * ⭐ **묶지 않으면 관리자가 옆으로 끝없이 스크롤한다** — 열이 화면 수만큼이다(고정 설계
 * `design/schema/generators/권한목록.md` 기준 113, 실기 서버 117. 그래서 이 화면은 건수를
 * 박아 두지 않고 받은 만큼 그린다).
 */
export interface PermissionGroup {
  /** 묶음의 신원. `groupCode` 이거나, 후보 밖 열을 모으는 자리표시다 */
  key: string;
  label: string;
  columns: PermissionColumn[];
}

/**
 * 후보에 `groupCode` 가 없을 때 쓰는 자리. 계약이 그 칸을 선택으로 두어 빠질 수 있다.
 *
 * ⛔ 빠진 것을 다른 묶음에 섞지 않는다 — 섞으면 그 묶음이 사실과 달라진다.
 */
const UNGROUPED_KEY = '';

/** 후보 밖 부여분을 모으는 묶음의 신원. 묶음 표에 넣지 않으므로 `groupCode` 와 겹쳐도 안전하다. */
const UNLISTED_GROUP_KEY = 'unlisted';

/**
 * 묶음 이름. `groupCode` 는 **개체 식별자**라 서버가 이름을 주지 않는다(계약 `x-no-code-key`).
 *
 * 고정 설계의 권한 목록 생성기가 축 7개의 이름을 적어 두었고 그것을 옮긴 것이다. **모르는
 * 축이 오면 코드를 그대로 낸다** — 없는 이름을 지어내면 그 묶음이 무엇인지 화면이 단정하게 된다.
 */
const groupLabelOf = (groupCode: string): string => {
  if (groupCode === UNGROUPED_KEY) return t.permission.groups.ungrouped;

  return t.permission.groups.byCode[groupCode] ?? groupCode;
};

/**
 * 격자의 열을 묶음별로 세운다.
 *
 * **차례는 후보 목록이 준 차례다.** 묶음도 후보에서 처음 나온 순서로 선다 — 화면이 다시
 * 정렬하면 서버가 뜻한 차례(도메인 순)가 사라지고, 목록이 바뀔 때마다 열 자리가 흔들린다.
 *
 * `selected` 는 **지금 화면이 든 초안**이다 — 켠 칸이 저장 전에도 바로 보여야 한다.
 *
 * `serverGranted` 는 **서버가 준 부여분**이고, 후보 밖 열이 «있는지»를 정하는 것은 이쪽이다.
 * ⛔ **초안으로 정하지 않는다** — 그러면 후보 밖 칸을 끄는 순간 초안에서 빠져 **열 자체가
 * 격자에서 사라지고**, 무엇을 껐는지도 모른 채 되돌릴 방법이 「취소」밖에 없게 된다.
 * 생략하면 초안을 그대로 쓴다(초안과 부여분이 같은 자리에서 부르는 경우).
 *
 * **같은 코드가 후보에 두 번 와도 열은 하나다.**
 *
 * **후보에 없는 부여분은 맨 뒤 묶음에 따로 세운다** — 빼면 실제로 가진 권한이 화면에서 사라진다.
 */
export const toPermissionGroups = (
  candidates: readonly Permission[],
  selected: readonly string[],
  serverGranted: readonly string[] = selected,
): PermissionGroup[] => {
  const grantedCodes = new Set(selected);
  const groups: PermissionGroup[] = [];
  const byKey = new Map<string, PermissionGroup>();
  const listed = new Set<string>();

  const groupFor = (key: string): PermissionGroup => {
    const found = byKey.get(key);

    if (found !== undefined) return found;

    const created: PermissionGroup = { key, label: groupLabelOf(key), columns: [] };

    byKey.set(key, created);
    groups.push(created);

    return created;
  };

  for (const candidate of candidates) {
    if (listed.has(candidate.code)) continue;

    listed.add(candidate.code);
    groupFor(candidate.groupCode ?? UNGROUPED_KEY).columns.push({
      code: candidate.code,
      label: candidate.name,
      isGranted: grantedCodes.has(candidate.code),
      isUnlisted: false,
    });
  }

  /*
   * 후보 밖 부여분은 **맨 뒤에 따로 세운다.** 위 묶음 표에 넣지 않는 것은, 자리표시 키를 두면
   * 그 키와 같은 `groupCode` 가 실제로 오는 날 두 묶음이 하나로 합쳐지기 때문이다.
   */
  const unlisted: PermissionGroup = {
    key: UNLISTED_GROUP_KEY,
    label: t.permission.groups.unlisted,
    columns: [],
  };

  for (const code of serverGranted) {
    if (listed.has(code)) continue;

    listed.add(code);
    unlisted.columns.push({
      /* 후보에 없어 이름을 모른다 — 코드를 그대로 낸다. */
      code,
      label: code,
      /* 꺼도 열은 남는다 — 그래야 다시 켤 수 있다. */
      isGranted: grantedCodes.has(code),
      isUnlisted: true,
    });
  }

  return unlisted.columns.length === 0 ? groups : [...groups, unlisted];
};

/** 묶음을 가로지르는 열 전체. 표가 한 줄씩 그릴 때와 초안을 셀 때 쓴다. */
export const flattenPermissionColumns = (groups: readonly PermissionGroup[]): PermissionColumn[] =>
  groups.flatMap((group) => group.columns);

/**
 * 표의 행 하나 — 열 하나에 **자기가 속한 묶음**을 붙인 것.
 *
 * ⭐ **표는 세로다.** 권한이 117개라 가로로 세우면 오른쪽 끝 권한을 **눌러서 고를 수가 없다** —
 * 격자가 자기 가로 스크롤 상자를 갖고, 페인이 화면보다 넓어져 아래 액션 줄까지 화면 밖으로
 * 밀린다(#1308 · 실사용 보고). 묶음은 `Table` 의 그룹 머리행으로 살리므로 행이 묶음을 들고 다닌다.
 */
export interface PermissionRow extends PermissionColumn {
  groupKey: string;
  groupLabel: string;
}

/** 묶음별 열을 표의 행 목록으로 편다. 차례는 묶음 차례 그대로다. */
export const toPermissionRows = (groups: readonly PermissionGroup[]): PermissionRow[] =>
  groups.flatMap((group) =>
    group.columns.map((column) => ({
      ...column,
      groupKey: group.key,
      groupLabel: group.label,
    })),
  );
