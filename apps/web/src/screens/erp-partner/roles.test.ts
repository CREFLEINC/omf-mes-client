import { describe, expect, it } from 'vitest';

import { formatRoles, isRoleCode, roleLabel } from './roles';

describe('거래처 역할 표시', () => {
  it('어휘 다섯을 먼저 세우고 같은 코드는 한 번만 낸다', () => {
    expect(
      formatRoles([
        { roleTypeCode: 'SUPPLIER' },
        { roleTypeCode: 'CUSTOMER' },
        { roleTypeCode: 'SUPPLIER' },
      ]),
    ).toBe('고객사, 공급사');
  });

  it('어휘 밖 코드는 서버 이름, 없으면 코드값 그대로 낸다', () => {
    expect(roleLabel('VENDOR_X', '외부 이름')).toBe('외부 이름');
    expect(roleLabel('VENDOR_X', '  ')).toBe('VENDOR_X');
  });

  it('역할이 없으면 빈 문자열이다', () => {
    expect(formatRoles([])).toBe('');
  });

  it('프로토타입 이름을 아는 코드로 보지 않는다', () => {
    expect(isRoleCode('toString')).toBe(false);
    expect(isRoleCode('DISPOSAL')).toBe(true);
  });
});
