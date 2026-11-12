import { describe, expect, it } from 'vitest';

import {
  formatPackage,
  formatPackageQty,
  matchesPackage,
  packageCountOf,
  packageProduct,
  parseQtyInput,
} from './package-qty';

const BAG = { uomCode: '봉지', count: 10, qtyPerPackage: 100 };

describe('package-qty — 자재 관리 LOT 재고 수량 · 패키징 표기(T027)', () => {
  it('US1-1 패키징이 있으면 「봉지 10 × 100 = 1,000 EA」', () => {
    expect(formatPackageQty(1000, 'EA', BAG)).toBe('봉지 10 × 100 = 1,000 EA');
    expect(formatPackage(BAG)).toBe('봉지 10 × 100');
  });

  it('G1 패키징 단위는 이름이 있으면 이름, 없거나 비면 코드', () => {
    expect(formatPackage({ uomCode: 'BAG', uomName: '봉지', count: 10, qtyPerPackage: 100 })).toBe(
      '봉지 10 × 100',
    );
    expect(formatPackage({ uomCode: 'BAG', uomName: ' ', count: 10, qtyPerPackage: 100 })).toBe(
      'BAG 10 × 100',
    );
    expect(formatPackage({ uomCode: 'BAG', count: 10, qtyPerPackage: 100 })).toBe('BAG 10 × 100');
  });

  it('US1-3 패키징이 없으면 기본 단위 수량만', () => {
    expect(formatPackageQty(1, 'TON', null)).toBe('1 TON');
    expect(formatPackage(null)).toBeNull();
    expect(formatPackageQty(2500, null, null)).toBe('2,500');
  });

  it('곱 검사 — 재고 수량이 패키징 수 × 패키징당 수량과 같아야 한다(FR-003)', () => {
    expect(packageProduct(10, 100)).toBe(1000);
    expect(matchesPackage(1000, BAG)).toBe(true);
    expect(matchesPackage(950, BAG)).toBe(false);
    expect(matchesPackage(950, null)).toBe(true);
    /* 소수 곱의 찌꺼기를 걷는다 — 0.1 × 3 = 0.3. */
    expect(matchesPackage(0.3, { uomCode: '드럼', count: 3, qtyPerPackage: 0.1 })).toBe(true);
  });

  it('기본 정보의 패키징 수 — 정수배일 때만', () => {
    expect(packageCountOf(1000, 100)).toBe(10);
    expect(packageCountOf(1050, 100)).toBeNull();
    expect(packageCountOf(1000, 0)).toBeNull();
  });

  it('입력 글을 수로 — 쉼표를 걷고 빈 칸은 null', () => {
    expect(parseQtyInput('1,000')).toBe(1000);
    expect(parseQtyInput('  ')).toBeNull();
    expect(parseQtyInput('abc')).toBeNull();
  });
});
