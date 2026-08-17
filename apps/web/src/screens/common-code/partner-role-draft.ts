import {
  PARTNER_ROLE_CODES,
  PARTNER_ROLE_ORDER,
  isKnownPartnerRole,
  partnerRoleLabel,
  sortPartnerRoles,
  type PartnerRoleCode,
} from './partner-role-vocab';

/**
 * 거래처 역할의 초안과 치환 본문.
 *
 * **전체 치환이다.** 체크칸 하나를 켤 때마다 서버를 부르지 않고 「저장」에서 최종 상태를
 * 통째로 보낸다 — 계약에 개별 추가·삭제 경로가 없다(집합이라 두 번 부르면 중간 상태가 생긴다).
 *
 * **화면이 역할 코드를 지어내지 않는다**(결정 8). 체크칸으로 설 수 있는 것은 ① 어휘 다섯과
 * ② **서버가 이미 준 어휘 밖 코드**뿐이다 — 어휘 밖 코드는 해제만 되고 새로 붙지 않는다.
 * 값 목록은 서버 소관이고, 화면이 지어낸 코드는 서버가 모른다.
 *
 * **읽기는 계약보다 넓고 쓰기는 계약대로 좁다**(계약 재동기화 #173). 그 경계가 이 파일에 있다 —
 * 아래 `PartnerRoleRow`가 넓은 쪽이고 `PartnerRolesPayload`가 좁은 쪽이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 읽기 경계의 역할 한 줄 — **계약보다 넓게 받는다**(의도적 이탈 · #173 회신 뒤의 결정 D-4).
 *
 * 계약은 `roleTypeCode`를 다섯으로 좁혔지만 **계약은 구현보다 앞선다** — 서버가 아직 다섯 밖의
 * 값을 들고 있을 수 있고, 그 값이 붙은 거래처를 이 화면이 열면 통째 교체 저장에서 **조용히
 * 사라진다.** 그것이 이 갈래가 애초에 막으려던 사고다. 그래서 읽는 쪽은 `string`으로 받아
 * 어휘 밖 코드를 화면에 세우고, 저장할 때 **해제 목록에 반드시 올린다**.
 *
 * ⛔ **쓰기에는 쓰지 않는다.** 치환 본문은 `PartnerRolesPayload`가 계약 유니온으로 좁힌다.
 * 목 서버는 계약을 따르므로 이 갈래를 재현하지 않는다 — `partner-role-draft.test.ts`의
 * 감지기가 유일한 재현 수단이다.
 */
export interface PartnerRoleRow {
  roleTypeCode: string;
  roleTypeName?: string | null;
}

/**
 * 치환 요청 본문. **속성이 이것 하나다** — 거래처 번호도 역할 이름도 담지 않는다(계약 실측).
 *
 * 코드는 **계약이 아는 다섯뿐이다**(#173 — 어휘 밖 값은 서버가 400으로 거절한다).
 * 타입이 그것을 강제하므로 어휘 밖 코드가 실리는 본문은 만들어질 수 없다.
 */
export interface PartnerRolesPayload {
  roleTypeCodes: PartnerRoleCode[];
}

/** 체크칸 하나가 될 역할. 화면은 이 목록만 보고 그린다. */
export interface PartnerRoleOption {
  roleTypeCode: string;
  /** 어휘 안이면 화면 표시명, 어휘 밖이면 `roleTypeName ?? 코드값` */
  label: string;
  /**
   * 계약이 아는 어휘인가. 아니면 「이 화면이 모르는 역할」 표식이 붙는다.
   *
   * **거짓이면 저장에 실을 수 없다**(#173 — 어휘 밖 값은 서버가 400으로 거절한다).
   * 그래서 이 값이 표식뿐 아니라 **해제 목록과 치환 본문의 판정 근거**이기도 하다.
   */
  isKnown: boolean;
}

export interface PartnerRoleChoice extends PartnerRoleOption {
  isSelected: boolean;
}

/** 어휘 다섯을 역할 모양으로. 붙어 있지 않아도 체크칸으로 서야 **역할을 붙일 수 있다.** */
const VOCABULARY_ROLES: readonly PartnerRoleRow[] = PARTNER_ROLE_ORDER.map((key) => ({
  roleTypeCode: PARTNER_ROLE_CODES[key],
}));

/** 앞에 온 것을 남기고 같은 코드를 접는다. 옛 자료가 같은 짝을 두 번 줄 수 있다. */
const dedupeByCode = (roles: readonly PartnerRoleRow[]): PartnerRoleRow[] => {
  const seen = new Set<string>();

  return roles.filter((role) => {
    if (seen.has(role.roleTypeCode)) return false;

    seen.add(role.roleTypeCode);

    return true;
  });
};

/**
 * 서버가 준 부여분에서 초안(선택된 코드 집합)을 세운다.
 *
 * **코드만 들고 다닌다.** 치환 본문이 `roleTypeCodes`뿐이라 나머지(`roleTypeName`)는
 * 되돌아 나갈 자리가 없다 — 들고 있으면 언젠가 실린다. 이름은 체크칸 목록이 따로 푼다.
 */
export const toPartnerRoleDraft = (roles: readonly PartnerRoleRow[]): string[] =>
  dedupeByCode(roles).map((role) => role.roleTypeCode);

/** 체크칸 하나를 켜고 끈다. 원본을 고치지 않는다 — 기준값이 함께 흔들리면 안 된다. */
export const togglePartnerRole = (selected: readonly string[], roleTypeCode: string): string[] =>
  selected.includes(roleTypeCode)
    ? selected.filter((current) => current !== roleTypeCode)
    : [...selected, roleTypeCode];

/**
 * 「고친 것이 있는가」의 판정 근거.
 *
 * **순서를 보지 않는다.** 체크 순서는 자료가 아니라 조작의 흔적이라, 순서로 판정하면
 * 껐다가 되돌려 놓아도 「고쳤다」로 남아 저장·취소가 사실과 어긋난다.
 */
export const isSamePartnerRoleSelection = (a: readonly string[], b: readonly string[]): boolean => {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((code) => right.has(code));
};

/**
 * 체크칸으로 설 역할 전부 — **어휘 다섯 + 지금 붙어 있는 어휘 밖 코드.**
 *
 * 차례는 `sortPartnerRoles`가 정한다(어휘 다섯이 먼저, 어휘 밖이 뒤). 차례를 여기서 다시
 * 세우지 않는 이유는 정하는 자리가 둘이 되면 반드시 한쪽이 어긋나기 때문이다.
 *
 * 서버가 준 것을 **앞에 두고** 접는다 — 어휘 밖 코드의 `roleTypeName`이 그래야 남는다.
 * (어휘 안의 코드는 화면 표시명이 이기므로 어느 쪽이 남든 결과가 같다.)
 */
export const toPartnerRoleOptions = (baseline: readonly PartnerRoleRow[]): PartnerRoleOption[] =>
  sortPartnerRoles(dedupeByCode([...baseline, ...VOCABULARY_ROLES])).map((role) => ({
    roleTypeCode: role.roleTypeCode,
    label: partnerRoleLabel(role.roleTypeCode, role.roleTypeName),
    isKnown: isKnownPartnerRole(role.roleTypeCode),
  }));

/** 지금 체크된 상태까지 얹은 목록. 화면이 그리는 것은 이것 하나다. */
export const toPartnerRoleChoices = (
  baseline: readonly PartnerRoleRow[],
  selected: readonly string[],
): PartnerRoleChoice[] => {
  const chosen = new Set(selected);

  return toPartnerRoleOptions(baseline).map((option) => ({
    ...option,
    isSelected: chosen.has(option.roleTypeCode),
  }));
};

/**
 * 저장하면 **해제되는** 역할 — 붙어 있었는데 **본문에 실리지 않는** 것.
 *
 * 갈래가 둘이다.
 *
 * 1. **체크를 껐다** — 사용자가 뜻해서 뺀 것.
 * 2. **어휘 밖 코드다** — 체크를 유지해도 실을 수 없다. 계약이 역할 코드를 다섯으로 좁혔고
 *    어휘 밖 값은 서버가 400으로 거절한다(#173). 통째 교체 저장은 그것을 반드시 떨어뜨린다.
 *
 * 둘째 갈래를 빠뜨리면 화면이 모르는 역할이 확인 창에도 나오지 않은 채 사라지고, 사용자는
 * 자기가 무엇을 잃었는지 알 방법이 없다 — **이 목록과 `toPartnerRolesPayload`는 같은 판정을
 * 반대편에서 본다.** 한쪽만 고치면 조용히 잃는 갈래가 되살아난다.
 *
 * 차례는 체크칸 목록과 같다 — 확인 창이 화면과 다른 차례로 나열하면 대조가 어렵다.
 */
export const releasedPartnerRoles = (
  baseline: readonly PartnerRoleRow[],
  selected: readonly string[],
): PartnerRoleOption[] => {
  const attached = new Set(baseline.map((role) => role.roleTypeCode));
  const chosen = new Set(selected);

  return toPartnerRoleOptions(baseline).filter(
    (option) =>
      attached.has(option.roleTypeCode) && !(chosen.has(option.roleTypeCode) && option.isKnown),
  );
};

/**
 * 치환 요청 본문.
 *
 * **최종 상태 전체를 싣는다.** 바뀐 것만 실으면 나머지가 전부 해제된다 — 계약이 통째 교체다.
 *
 * 차례는 **체크칸 목록이 준 차례**(어휘 다섯의 결정된 차례)다. 집합이라 차례에 뜻은 없지만
 * 고정해 두어야 같은 선택에서 매번 같은 본문이 나간다 — 체크한 순서로 실으면 캐시도 시험도
 * 흔들린다. **중복을 싣지 않는다**(집합이다).
 *
 * **어휘 밖 코드는 떨어뜨린다**(#173). 계약이 값 목록을 못 박기 전에는 「보존이 기본」이라
 * 그대로 실었으나, 이제 그 본문은 서버가 **통째로 거절하는 요청**이 된다 — 하나를 지키려다
 * 저장 전체를 막는다. 잃는 사실은 `releasedPartnerRoles`가 확인 창으로 밝힌다.
 *
 * 고른 코드는 늘 체크칸 목록 안에 있다 — 초안이 `baseline`에서 세워지고 켜고 끄는 자리도
 * 그 목록뿐이다. 그래서 목록 밖 코드를 따로 주워 담는 갈래를 두지 않는다.
 */
export const toPartnerRolesPayload = (
  baseline: readonly PartnerRoleRow[],
  selected: readonly string[],
): PartnerRolesPayload => {
  const chosen = new Set(selected);

  return {
    roleTypeCodes: toPartnerRoleOptions(baseline)
      .filter((option) => chosen.has(option.roleTypeCode))
      .map((option) => option.roleTypeCode)
      .filter(isKnownPartnerRole),
  };
};
