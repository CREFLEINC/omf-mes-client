import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  defaultWarehouseFilters,
  ensureOption,
  selectableOptions,
  type CodeOption,
} from './code-options';
import type { LookupEntry } from './types';

const options: CodeOption[] = [
  { value: 'MATERIAL', label: '자재창고' },
  { value: 'PRODUCT', label: '제품창고' },
];

const lookupSource = (
  entries: LookupEntry[],
  state: 'ready' | 'loading' | 'failed' = 'ready',
): LookupSource<LookupEntry> => ({
  entries,
  isError: state === 'failed',
  isLoading: state === 'loading',
});

describe('defaultWarehouseFilters', () => {
  it('아무 조건도 걸지 않은 상태다', () => {
    expect(defaultWarehouseFilters).toEqual({
      q: '',
      warehouseTypeCode: '',
      includeInactive: false,
    });
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

describe('selectableOptions', () => {
  it('사용 중인 값과 현재 선택된 미사용 값을 이름으로 남긴다', () => {
    const entries: LookupEntry[] = [
      { value: '11', label: '제1공장', isActive: true },
      { value: '12', label: '제2공장', isActive: false },
    ];

    expect(selectableOptions(lookupSource(entries), '12')).toEqual([
      { value: '11', label: '제1공장' },
      { value: '12', label: `제2공장${messages.common.reference.inactiveSuffix}` },
    ]);
  });

  it.each([
    ['ready', messages.common.reference.unknown],
    ['loading', messages.common.reference.loading],
    ['failed', messages.common.reference.failed],
  ] as const)('%s 상태의 미확인 FK는 값만 보존하고 번호를 라벨로 내지 않는다', (state, label) => {
    const result = selectableOptions(lookupSource([], state), '9999');

    expect(result).toEqual([{ value: '9999', label }]);
    expect(result[0]?.label).not.toContain('9999');
  });
});
