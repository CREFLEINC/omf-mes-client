import { messages } from '@omf-mes/i18n';

import type { PartnerRole, PartnerRoleCode } from './queries';

const t = messages.erpPartner;

/**
 * 거래처 역할 어휘 다섯. 코드는 계약 enum 에서 파생해 검사받는다 —
 * 계약이 값을 늘리거나 이름을 바꾸면 아래 표에서 컴파일이 멈춘다.
 *
 * 다른 화면 슬라이스(`common-code/partner-role-vocab.ts`)에 같은 표가 있지만 가져오지 않는다 —
 * 슬라이스끼리 참조하면 한쪽 사정이 번진다. 차례도 그쪽과 같게 둔다(고객사 → 공급사 → …).
 */
const ROLE_KEY_BY_CODE: Record<PartnerRoleCode, keyof typeof t.roleNames> = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  SUBCONTRACTOR: 'subcontractor',
  DISPOSAL: 'disposal',
  OTHER: 'other',
};

/** 조건 줄의 역할 선택지 차례. */
export const ROLE_CODES: readonly PartnerRoleCode[] = [
  'CUSTOMER',
  'SUPPLIER',
  'SUBCONTRACTOR',
  'DISPOSAL',
  'OTHER',
];

/** `Map`이라 아무 글자나 물어도 안전하다 — 객체 첨자는 `toString` 같은 이름을 「아는 코드」로 만든다. */
const KEY_BY_CODE = new Map<string, keyof typeof t.roleNames>(Object.entries(ROLE_KEY_BY_CODE));

export const isRoleCode = (code: string): code is PartnerRoleCode => KEY_BY_CODE.has(code);

/**
 * 역할 하나의 표시명. 어휘 안이면 이 화면의 이름, 밖이면 서버 이름, 그것도 없으면 코드값 그대로 —
 * 이름을 지어내지 않는다.
 */
export const roleLabel = (code: string, roleTypeName?: string | null): string => {
  const key = KEY_BY_CODE.get(code);
  if (key !== undefined) return t.roleNames[key];
  return roleTypeName === null || roleTypeName === undefined || roleTypeName.trim() === ''
    ? code
    : roleTypeName;
};

const orderOf = (code: string): number => {
  const index = ROLE_CODES.indexOf(code as PartnerRoleCode);
  return index === -1 ? ROLE_CODES.length : index;
};

/**
 * 역할 목록을 한 줄 문구로. 어휘 다섯이 먼저, 어휘 밖이 뒤 — 서버 응답 순서대로 쓰면 같은 거래처의
 * 칸이 조회마다 달라 보인다. 같은 코드가 두 번 와도 한 번만 낸다. 비어 있으면 빈 문자열이다.
 */
export const formatRoles = (roles: readonly PartnerRole[]): string => {
  const seen = new Set<string>();
  return [...roles]
    .sort((a, b) => orderOf(a.roleTypeCode) - orderOf(b.roleTypeCode))
    .filter((role) => {
      if (seen.has(role.roleTypeCode)) return false;
      seen.add(role.roleTypeCode);
      return true;
    })
    .map((role) => roleLabel(role.roleTypeCode, role.roleTypeName))
    .join(t.values.roleSeparator);
};
