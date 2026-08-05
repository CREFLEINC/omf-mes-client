import { describe, expect, it } from 'vitest';

import { defaultWarehouseFilters, ensureOption, type CodeOption } from './code-options';

const options: CodeOption[] = [
  { value: 'MATERIAL', label: '자재창고' },
  { value: 'PRODUCT', label: '제품창고' },
];

describe('defaultWarehouseFilters', () => {
  it('아무 조건도 걸지 않은 상태다', () => {
    expect(defaultWarehouseFilters).toEqual({ q: '', warehouseTypeCode: '', includeInactive: false });
  });
});

describe('ensureOption', () => {
  it('목록에 있는 값이면 그대로 둔다', () => {
    expect(ensureOption(options, 'PRODUCT')).toBe(options);
  });

  it('빈 값이면 아무것도 덧붙이지 않는다 — 선택하지 않은 상태다', () => {
    expect(ensureOption(options, '')).toBe(options);
  });

  it('목록에 없는 값은 코드 그대로 덧붙여 현재 값이 사라지지 않게 한다', () => {
    const result = ensureOption(options, 'SEMI_FINISHED');

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ value: 'SEMI_FINISHED', label: 'SEMI_FINISHED' });
  });

  it('원본 배열을 바꾸지 않는다', () => {
    ensureOption(options, 'SEMI_FINISHED');

    expect(options).toHaveLength(2);
  });
});
