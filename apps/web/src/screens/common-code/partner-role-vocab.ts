import { messages } from '@omf-mes/i18n';

/**
 * 거래처 역할 어휘 다섯 — **코드 표기(영문 글자)가 사는 유일한 자리.**
 *
 * 명칭과 의미는 **업무가 확정했다**(2026-08-16 사용자 결정 — 고객사·공급사·외주 제작사·
 * 폐기 업체·기타). ⚠ **영문 표기는 계약(서버 명세)이 역할 코드 enum을 편입하기 전까지
 * 잠정이다.** 확정되면 아래 표 한 자리만 바뀌고, 짝이 되는 기대값은
 * `partner-role-vocab.test.ts`가 **리터럴로 고정**해 다른 철자가 오면 운다.
 *
 * **같은 글자의 짝이 하나 더 있다** — `screens/disposal-issue/code-options.ts`의
 * `DISPOSAL_PARTNER_ROLE_CODE`(폐기 거래처 선택지를 **좁히는** 쪽의 조건 한 줄). 화면
 * 슬라이스는 서로 import하지 않으므로 두 사본이 각자 산다. **한쪽만 고치면 아무 시험도
 * 울지 않는다** — 이쪽을 고칠 때는 저 경로를 함께 연다. (감출 수 없는 한계라 감추지 않고 적는다.)
 *
 * **한국어 표시명은 여기 두지 않는다.** 문구 정본은 `ko.ts`의 `commonCode.partnerRole.names`다 —
 * 코드 파일이 사람 이름을 들고 있으면 정본이 둘이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.commonCode.partnerRole;

export const PARTNER_ROLE_CODES = {
  customer: 'CUSTOMER',
  supplier: 'SUPPLIER',
  subcontractor: 'SUBCONTRACTOR',
  disposal: 'DISPOSAL',
  other: 'OTHER',
} as const;

export type PartnerRoleKey = keyof typeof PARTNER_ROLE_CODES;

/**
 * 화면에 서는 차례. **계약이 아니라 화면이 정한다** — 계약은 역할 목록의 차례에 뜻을 두지
 * 않으며, 서버 응답 순서대로 그리면 저장할 때마다 항목이 움직인다.
 */
export const PARTNER_ROLE_ORDER: readonly PartnerRoleKey[] = [
  'customer',
  'supplier',
  'subcontractor',
  'disposal',
  'other',
];

/** 코드 → 어휘 열쇠. 판정과 표시명 풀이가 같은 표를 본다. */
const KEY_BY_CODE = new Map<string, PartnerRoleKey>(
  PARTNER_ROLE_ORDER.map((key) => [PARTNER_ROLE_CODES[key], key]),
);

/**
 * 이 화면이 아는 역할인가. **아니라고 해서 잘못된 값이 아니다** —
 * 계약이 값 목록을 아직 못 박지 않아 서버가 다섯 밖의 코드를 줄 수 있다.
 */
export const isKnownPartnerRole = (code: string): boolean => KEY_BY_CODE.has(code);

/**
 * 역할 하나의 표시명.
 *
 * **어휘 안의 코드는 이 화면의 표시명이 이긴다** — 서버가 준 이름으로 대체하면 다섯 항목의
 * 이름이 서버 상태에 따라 흔들린다. **어휘 밖의 코드만** 서버 이름(`roleTypeName`)으로 풀고,
 * 그것도 없으면 **코드값을 그대로** 낸다 — 이름을 지어내지 않는다.
 *
 * 서버가 빈 문구를 주는 일이 실제로 있다. 공백뿐인 이름을 그대로 쓰면 항목이 이름 없이 서고,
 * 사용자는 무엇이 걸려 있는지 읽을 수 없다.
 */
export const partnerRoleLabel = (code: string, roleTypeName?: string | null): string => {
  const key = KEY_BY_CODE.get(code);

  if (key !== undefined) return t.names[key];

  return roleTypeName === null || roleTypeName === undefined || roleTypeName.trim() === ''
    ? code
    : roleTypeName;
};

/** 어휘 밖 코드는 다섯 뒤에 선다. 다섯 안에서는 `PARTNER_ROLE_ORDER`의 자리가 곧 차례다. */
const orderIndexOf = (code: string): number => {
  const key = KEY_BY_CODE.get(code);

  return key === undefined ? PARTNER_ROLE_ORDER.length : PARTNER_ROLE_ORDER.indexOf(key);
};

/**
 * 보이는 차례로 세운다 — **어휘 다섯이 먼저, 어휘 밖 코드가 뒤.**
 *
 * 어휘 밖끼리는 서버가 준 차례를 그대로 지킨다(정렬이 안정적이다) —
 * 화면이 뜻 없는 순서를 지어내지 않는다.
 *
 * 받은 배열을 그대로 두고 새 배열을 낸다 — 조회 캐시가 들고 있는 배열을 뒤집으면
 * 다음 렌더가 다른 자료를 보게 된다.
 */
export const sortPartnerRoles = <T extends { roleTypeCode: string }>(roles: readonly T[]): T[] =>
  [...roles].sort((a, b) => orderIndexOf(a.roleTypeCode) - orderIndexOf(b.roleTypeCode));
