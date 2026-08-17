import { messages } from '@omf-mes/i18n';

import type { PartnerRole } from './types';

/**
 * 거래처 역할 어휘 다섯 — **코드 표기(영문 글자)가 사는 유일한 자리.**
 *
 * 명칭과 의미는 **업무가 확정했다**(2026-08-16 사용자 결정 — 고객사·공급사·외주 제작사·
 * 폐기 업체·기타). 영문 표기도 **계약이 enum으로 확정했다**(#173) — 어휘 밖 값은 서버가
 * 400으로 거절한다. 아래 표는 계약 타입에서 파생한 `PartnerRoleCode`로 검사받으며, 짝이 되는
 * 기대값은 `partner-role-vocab.test.ts`가 **리터럴로 고정**해 다른 철자가 오면 운다.
 *
 * **같은 글자의 짝이 하나 더 있다** — `screens/disposal-issue/code-options.ts`의
 * `DISPOSAL_PARTNER_ROLE_CODE`(폐기 거래처 선택지를 **좁히는** 쪽의 조건 한 줄). 화면
 * 슬라이스는 서로 import하지 않으므로 두 사본이 각자 산다. 이제 **둘 다 계약 타입에서
 * 파생**하므로 계약이 값을 늘리거나 이름을 바꾸면 두 사본이 함께 컴파일에서 멈춘다. 다만
 * 두 사본이 서로 **다른 값**을 고르는 어긋남은 타입이 잡지 못한다 — 그 축은 두 파일의
 * 리터럴 고정 감지기가 계속 맡는다. (감출 수 없는 한계라 감추지 않고 적는다.)
 *
 * **한국어 표시명은 여기 두지 않는다.** 문구 정본은 `ko.ts`의 `commonCode.partnerRole.names`다 —
 * 코드 파일이 사람 이름을 들고 있으면 정본이 둘이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.commonCode.partnerRole;

/** 계약이 정한 역할 코드. **생성물 타입에서 파생한다** — 손으로 적은 유니온을 두지 않는다. */
export type PartnerRoleCode = PartnerRole['roleTypeCode'];

/**
 * **계약이 실제로 좁혀 두었는가**를 타입으로 못박는다.
 *
 * 파생은 한 방향으로만 운다 — 계약이 값을 늘리거나 이름을 바꾸면 아래 대응표가 깨지지만,
 * 계약이 **다시 자유 문자열로 넓어지면** 대응표가 다섯 열쇠로도 충족돼 아무것도 울지 않는다.
 * 그때 치환 본문의 협착은 **계약에 없는 제약**이 되어, 서버가 아는 여섯째 역할이 와도 화면이
 * 그것을 말없이 떨어뜨린다.
 *
 * ⛔ **지우지 않는다.** 아무 데서도 읽지 않는 것이 이 상수의 형태다 — 하는 일이 대입 그
 * 자체이고, `PartnerRoleCode`가 `string`으로 넓어지면 이 타입이 `never`가 되어 `true`를
 * 받지 못한다.
 */
type PartnerRoleIsNarrowed = string extends PartnerRoleCode ? never : true;

const PARTNER_ROLE_IS_NARROWED: PartnerRoleIsNarrowed = true;

export const PARTNER_ROLE_CODES = {
  customer: 'CUSTOMER',
  supplier: 'SUPPLIER',
  subcontractor: 'SUBCONTRACTOR',
  disposal: 'DISPOSAL',
  other: 'OTHER',
} as const satisfies Record<string, PartnerRoleCode>;

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

/**
 * 계약 코드 → 어휘 열쇠. **계약의 다섯을 빠짐없이 덮는지 타입이 잰다** —
 * 계약이 값을 늘리면 빠진 열쇠에서, 이름을 바꾸면 없는 열쇠에서 컴파일이 멈춘다.
 *
 * 값은 `PARTNER_ROLE_CODES`에서 계산해 온다 — 글자를 다시 적으면 정본이 둘이 된다.
 */
const PARTNER_ROLE_KEY_BY_CODE: Record<PartnerRoleCode, PartnerRoleKey> = {
  [PARTNER_ROLE_CODES.customer]: 'customer',
  [PARTNER_ROLE_CODES.supplier]: 'supplier',
  [PARTNER_ROLE_CODES.subcontractor]: 'subcontractor',
  [PARTNER_ROLE_CODES.disposal]: 'disposal',
  [PARTNER_ROLE_CODES.other]: 'other',
};

/**
 * 코드 → 어휘 열쇠. 판정과 표시명 풀이가 같은 표를 본다.
 *
 * **`Map`이라 아무 글자나 물어도 안전하다.** 객체 첨자로 바꾸면 `toString` 같은
 * 프로토타입 이름이 「아는 코드」가 되어 치환 본문에 실린다.
 */
const KEY_BY_CODE = new Map<string, PartnerRoleKey>(Object.entries(PARTNER_ROLE_KEY_BY_CODE));

/**
 * 계약이 아는 역할인가 — **화면이 아는 다섯과 같은 집합이다**(#173).
 *
 * 계약이 값 목록을 못 박기 전에는 「화면이 모를 뿐 잘못된 값은 아니다」였다. 이제 어휘 밖
 * 값은 **서버가 400으로 거절한다** — 그래서 이 판정이 곧 「치환 본문에 실을 수 있는가」다.
 * 읽기는 여전히 넓게 받는다(어휘 밖 코드도 화면에 서고 해제 목록에 오른다).
 */
export const isKnownPartnerRole = (code: string): code is PartnerRoleCode => KEY_BY_CODE.has(code);

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
