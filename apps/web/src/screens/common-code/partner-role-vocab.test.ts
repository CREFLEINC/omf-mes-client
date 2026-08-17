import { describe, expect, it } from 'vitest';

import {
  PARTNER_ROLE_CODES,
  PARTNER_ROLE_ORDER,
  isKnownPartnerRole,
  partnerRoleLabel,
  sortPartnerRoles,
} from './partner-role-vocab';

/**
 * **이 파일이 코드 표기의 감지기다.** 계약이 다른 철자를 확정하면 여기가 운다 —
 * 그래서 기대값을 상수에서 꺼내 오지 않고 **리터럴로 적는다**(자기참조면 함께 바뀌어 침묵한다).
 *
 * 짝이 되는 사본이 `screens/disposal-issue/code-options.ts`의 `DISPOSAL_PARTNER_ROLE_CODE`에
 * 있고 그쪽도 자기 리터럴을 고정한다. **한쪽만 고치면 아무도 울지 않는다** — 감출 수 없는
 * 한계라 두 파일 주석이 서로의 경로를 적어 둔다.
 *
 * **계약과의 어긋남은 타입이 먼저 잡는다**(#173). 표가 계약 유니온으로 검사받고, 코드 →
 * 어휘 열쇠 대응표가 계약의 다섯을 빠짐없이 덮어야 컴파일된다. 이 파일이 재는 것은 그 위에
 * 남는 축 — **어떤 글자인가**다.
 */
describe('PARTNER_ROLE_CODES — 어휘 다섯의 코드 표기', () => {
  it('다섯 코드가 확정된 글자 그대로다', () => {
    expect(PARTNER_ROLE_CODES.customer).toBe('CUSTOMER');
    expect(PARTNER_ROLE_CODES.supplier).toBe('SUPPLIER');
    expect(PARTNER_ROLE_CODES.subcontractor).toBe('SUBCONTRACTOR');
    expect(PARTNER_ROLE_CODES.disposal).toBe('DISPOSAL');
    expect(PARTNER_ROLE_CODES.other).toBe('OTHER');
  });

  it('어휘는 다섯뿐이다 — 화면이 늘리거나 줄이지 않는다', () => {
    expect(Object.keys(PARTNER_ROLE_CODES)).toHaveLength(5);
  });

  /**
   * **어휘 다섯이 계약의 다섯을 빠짐없이 덮는다.**
   *
   * 대응표가 `Record<PartnerRoleCode, PartnerRoleKey>`라 계약이 값을 늘리면 컴파일이 멈추지만,
   * 그 표가 실제로 다섯 코드를 **판정에 쓰고 있는지**는 타입이 말해 주지 않는다 — 표를 만들어
   * 놓고 조회를 다른 자료로 하면 침묵한다. 그래서 판정 쪽에서 한 번 더 센다.
   */
  it('어휘 다섯이 모두 아는 코드로 판정된다 — 표와 판정이 같은 자료를 본다', () => {
    const known = Object.values(PARTNER_ROLE_CODES).filter((code) => isKnownPartnerRole(code));

    expect(known).toHaveLength(5);
  });

  it('코드가 서로 겹치지 않는다', () => {
    const codes = Object.values(PARTNER_ROLE_CODES);

    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('PARTNER_ROLE_ORDER — 화면에 서는 차례', () => {
  /*
   * 서버 응답 순서로 그리면 저장할 때마다 항목이 움직인다 — 차례는 화면이 정한다.
   * 계약은 역할 목록의 차례에 뜻을 두지 않는다.
   */
  it('결정된 차례 그대로다', () => {
    expect(PARTNER_ROLE_ORDER).toEqual([
      'customer',
      'supplier',
      'subcontractor',
      'disposal',
      'other',
    ]);
  });

  it('어휘 다섯을 하나도 빠뜨리지 않고 한 번씩만 담는다', () => {
    expect([...PARTNER_ROLE_ORDER].sort()).toEqual(Object.keys(PARTNER_ROLE_CODES).sort());
  });
});

describe('isKnownPartnerRole — 어휘 밖 판정', () => {
  it('어휘 다섯은 아는 코드다', () => {
    for (const code of Object.values(PARTNER_ROLE_CODES)) {
      expect(isKnownPartnerRole(code)).toBe(true);
    }
  });

  it('다섯에 없는 코드는 모르는 코드다 — 잘못된 값이 아니라 화면이 모르는 값이다', () => {
    expect(isKnownPartnerRole('SAMPLE-ROLE-X')).toBe(false);
  });

  it('빈 값도 모르는 코드다', () => {
    expect(isKnownPartnerRole('')).toBe(false);
  });

  /* 코드는 내부 식별자다. 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다. */
  it('대소문자가 다르면 모르는 코드다', () => {
    expect(isKnownPartnerRole('disposal')).toBe(false);
  });

  /**
   * **프로토타입 이름이 「아는 코드」가 되면 안 된다.**
   *
   * 이 판정은 이제 「치환 본문에 실을 수 있는가」이기도 하다(#173) — 표 조회를 객체 첨자나
   * `in`으로 「단순화」하면 `toString` 같은 이름이 통과해 되돌릴 수 없는 저장에 실린다.
   */
  it.each(['toString', 'constructor', 'hasOwnProperty'])(
    '프로토타입 이름(%s)은 모르는 코드다',
    (code) => {
      expect(isKnownPartnerRole(code)).toBe(false);
    },
  );
});

describe('partnerRoleLabel — 표시명 풀이', () => {
  /*
   * 어휘 안의 다섯은 **문구 정본(`ko.ts`)이 이긴다.** 서버가 준 이름으로 대체하면
   * 다섯 항목의 이름이 서버 상태에 따라 흔들린다.
   */
  it('어휘 안의 코드는 이 화면의 표시명으로 푼다', () => {
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.customer)).toBe('고객사');
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.supplier)).toBe('공급사');
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.subcontractor)).toBe('외주 제작사');
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.disposal)).toBe('폐기 업체');
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.other)).toBe('기타');
  });

  it('어휘 안의 코드는 서버가 다른 이름을 줘도 화면 표시명을 쓴다', () => {
    expect(partnerRoleLabel(PARTNER_ROLE_CODES.disposal, '폐기처리')).toBe('폐기 업체');
  });

  it('어휘 밖의 코드는 서버가 준 이름으로 푼다', () => {
    expect(partnerRoleLabel('SAMPLE-ROLE-X', '샘플 역할 엑스')).toBe('샘플 역할 엑스');
  });

  it('어휘 밖의 코드에 이름이 없으면 코드값을 그대로 낸다 — 이름을 지어내지 않는다', () => {
    expect(partnerRoleLabel('SAMPLE-ROLE-X')).toBe('SAMPLE-ROLE-X');
    expect(partnerRoleLabel('SAMPLE-ROLE-X', null)).toBe('SAMPLE-ROLE-X');
  });

  /* 빈 이름을 그대로 쓰면 항목이 이름 없이 서고, 사용자는 무엇을 해제하는지 모른다. */
  it('어휘 밖의 코드에 이름이 공백뿐이면 코드값을 낸다', () => {
    expect(partnerRoleLabel('SAMPLE-ROLE-X', '   ')).toBe('SAMPLE-ROLE-X');
  });
});

describe('sortPartnerRoles — 보이는 차례', () => {
  it('어휘 다섯을 결정된 차례로 세운다 — 서버가 준 순서를 따르지 않는다', () => {
    const sorted = sortPartnerRoles([
      { roleTypeCode: PARTNER_ROLE_CODES.other },
      { roleTypeCode: PARTNER_ROLE_CODES.disposal },
      { roleTypeCode: PARTNER_ROLE_CODES.customer },
    ]);

    expect(sorted.map((role) => role.roleTypeCode)).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.disposal,
      PARTNER_ROLE_CODES.other,
    ]);
  });

  /* 어휘 밖 코드는 감추지 않는다 — 감추면 통째 교체 저장에서 조용히 해제된다. */
  it('어휘 밖 코드는 다섯 뒤에 이어 붙인다', () => {
    const sorted = sortPartnerRoles([
      { roleTypeCode: 'SAMPLE-ROLE-X' },
      { roleTypeCode: PARTNER_ROLE_CODES.supplier },
    ]);

    expect(sorted.map((role) => role.roleTypeCode)).toEqual([
      PARTNER_ROLE_CODES.supplier,
      'SAMPLE-ROLE-X',
    ]);
  });

  it('어휘 밖끼리는 서버가 준 차례를 지킨다 — 화면이 뜻 없는 순서를 지어내지 않는다', () => {
    const sorted = sortPartnerRoles([
      { roleTypeCode: 'SAMPLE-ROLE-Z' },
      { roleTypeCode: 'SAMPLE-ROLE-A' },
    ]);

    expect(sorted.map((role) => role.roleTypeCode)).toEqual(['SAMPLE-ROLE-Z', 'SAMPLE-ROLE-A']);
  });

  it('받은 배열을 그대로 두고 새 배열을 낸다', () => {
    const roles = [
      { roleTypeCode: PARTNER_ROLE_CODES.other },
      { roleTypeCode: PARTNER_ROLE_CODES.customer },
    ];

    const sorted = sortPartnerRoles(roles);

    expect(roles.map((role) => role.roleTypeCode)).toEqual([
      PARTNER_ROLE_CODES.other,
      PARTNER_ROLE_CODES.customer,
    ]);
    expect(sorted).not.toBe(roles);
  });

  /* 서버가 준 이름도 함께 따라와야 어휘 밖 코드를 풀 수 있다. */
  it('정렬해도 각 항목의 값이 그대로 따라온다', () => {
    const sorted = sortPartnerRoles([
      { roleTypeCode: 'SAMPLE-ROLE-X', roleTypeName: '샘플 역할 엑스' },
      { roleTypeCode: PARTNER_ROLE_CODES.disposal, roleTypeName: '폐기처리' },
    ]);

    expect(sorted[0]).toEqual({
      roleTypeCode: PARTNER_ROLE_CODES.disposal,
      roleTypeName: '폐기처리',
    });
    expect(sorted[1]).toEqual({ roleTypeCode: 'SAMPLE-ROLE-X', roleTypeName: '샘플 역할 엑스' });
  });
});
