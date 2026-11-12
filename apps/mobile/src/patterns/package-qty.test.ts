import { describe, expect, it } from 'vitest';

import {
  checkEntry,
  conversionText,
  enteredText,
  exceedsStock,
  packagesToBase,
  packageText,
  packageUnitOf,
  qtyText,
  wholePackagesOf,
  type PackageUnit,
} from './package-qty';

/* 가상 패키징 — 봉지 하나에 100 EA. */
const BAG = packageUnitOf({
  uomId: 701,
  uomCode: 'BAG',
  uomName: '봉지',
  count: 10,
  qtyPerPackage: 100,
});

const bag = (): PackageUnit => {
  if (BAG === null) {
    throw new Error('패키징을 만들지 못했습니다');
  }

  return BAG;
};

describe('패키징 환산 · 표기(US6 · FR-033·034)', () => {
  it('SC-007 패키징 수 × 패키징당 수량 — 3봉지 = 300 EA', () => {
    expect(packagesToBase(3, bag())).toBe(300);
    expect(conversionText(3, bag(), 'EA')).toBe('⇄ 3봉지 = 300 EA'); // 「⇄」 시안(G2 L20)
  });

  it('SC-007 소수 패키징 수량도 곱한 값 그대로 보낸다(이진 소수 오차 없음)', () => {
    const unit: PackageUnit = { unitName: '봉지', qtyPerPackage: 0.1 };

    expect(packagesToBase(3, unit)).toBe(0.3);
  });

  it('US6-1 남은 재고 「700 EA (7봉지)」', () => {
    expect(qtyText(700, 'EA', bag())).toBe('700 EA (7봉지)');
  });

  it('US6-2 낱개가 있으면 「650 EA (6봉지 + 50)」', () => {
    expect(qtyText(650, 'EA', bag())).toBe('650 EA (6봉지 + 50)');
    expect(wholePackagesOf(650, bag())).toBe(6);
  });

  it('온전한 봉지가 없으면 「낱개 50」', () => {
    expect(packageText(50, bag())).toBe('낱개 50');
  });

  it('US6-3 패키징이 없으면 기본 단위만 — 단위를 고를 패키징도 없다', () => {
    expect(packageUnitOf(null)).toBeNull();
    expect(packageUnitOf(undefined)).toBeNull();
    expect(qtyText(25, 'KG', null)).toBe('25 KG');
  });

  it('패키징 단위 이름이 없으면 단위 코드를 쓴다', () => {
    /* 생성 계약은 이름을 늘 싣는다 — 이름이 빠진 응답(계약 밖)에도 코드로 보이는지 지킨다. */
    const unit = packageUnitOf({
      uomId: 702,
      uomCode: 'BOX',
      count: 4,
      qtyPerPackage: 50,
    } as Parameters<typeof packageUnitOf>[0]);

    expect(unit?.unitName).toBe('BOX');
  });

  it('넣은 값의 표기 — 패키징이면 「3봉지」, 기본 단위면 「50 EA」', () => {
    expect(enteredText(3, 'package', 'EA', bag())).toBe('3봉지');
    expect(enteredText(50, 'base', 'EA', bag())).toBe('50 EA');
  });
});

describe('패키징 입력 검사', () => {
  const base = { unit: bag(), remaining: 400, stock: 1000 };

  it('SC-007 봉지 3 → 보낼 값 300, 막힘 없음', () => {
    expect(checkEntry({ ...base, text: '3', entryUnit: 'package' })).toEqual({
      baseQty: 300,
      problem: null,
    });
  });

  it('봉지 수는 정수만', () => {
    expect(checkEntry({ ...base, text: '1.5', entryUnit: 'package' }).problem).toBe('notInteger');
  });

  it('0 이하는 막는다', () => {
    expect(checkEntry({ ...base, text: '0', entryUnit: 'package' }).problem).toBe('notPositive');
  });

  it('남은 재고 초과 — 남은 온전한 봉지 수를 넘으면 막는다', () => {
    expect(
      checkEntry({ ...base, stock: 250, remaining: 400, text: '3', entryUnit: 'package' }).problem,
    ).toBe('overPackages');
    expect(exceedsStock(300, 250)).toBe(true);
    expect(exceedsStock(300, null)).toBe(false);
  });

  it('남은 요청 검사는 기본 단위로 환산해서 한다', () => {
    expect(checkEntry({ ...base, text: '5', entryUnit: 'package' })).toEqual({
      baseQty: 500,
      problem: 'overPlanned',
    });
    expect(checkEntry({ ...base, text: '401', entryUnit: 'base' }).problem).toBe('overPlanned');
  });

  it('재고를 모르면 봉지 수 검사는 서지 않는다 — 판정은 서버가 한다', () => {
    expect(
      checkEntry({ ...base, stock: null, text: '4', entryUnit: 'package' }).problem,
    ).toBeNull();
  });
});
