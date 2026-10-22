import { describe, expect, it } from 'vitest';

import { readRegisterEntry, withoutRegisterEntry, withRegisterEntry } from './register-entry';

describe('readRegisterEntry — 입하 등록 창은 주소가 연다', () => {
  it('register=1 과 발주 번호가 함께 있어야 연다', () => {
    expect(readRegisterEntry(new URLSearchParams('register=1&po=7101'))).toBe(7101);
    expect(readRegisterEntry(new URLSearchParams('po=7101'))).toBeNull();
    expect(readRegisterEntry(new URLSearchParams('register=1'))).toBeNull();
  });

  it.each(['0', '-3', '1.5', 'abc', ''])('발주 번호가 %s 이면 열지 않는다', (po) => {
    expect(readRegisterEntry(new URLSearchParams({ register: '1', po }))).toBeNull();
  });
});

describe('withRegisterEntry · withoutRegisterEntry', () => {
  it('조회 조건은 두고 연결 창 키는 걷어 낸다 — 창은 한 번에 하나다', () => {
    const next = withRegisterEntry(
      new URLSearchParams('supplier=3&po=1&excess=1&excessReceipt=SAMPLE-IR-1'),
      7101,
    );

    expect(next.toString()).toBe('supplier=3&po=7101&register=1');
  });

  it('닫으면 register 만 빠지고 고른 발주는 남는다', () => {
    expect(withoutRegisterEntry(new URLSearchParams('po=7101&register=1')).toString()).toBe(
      'po=7101',
    );
  });
});
