import { describe, expect, it } from 'vitest';

import { toLotStatusSort, toTableSort } from './current-sort';

describe('현재 LOT 서버 정렬 변환', () => {
  it.each([
    ['lotNoAsc', 'lotNo', 'ascending'],
    ['lotNoDesc', 'lotNo', 'descending'],
    ['itemAsc', 'item', 'ascending'],
    ['itemDesc', 'item', 'descending'],
    ['latestTransitionAsc', 'latestTransitionAt', 'ascending'],
    ['latestTransitionDesc', 'latestTransitionAt', 'descending'],
  ] as const)('%s를 같은 표 정렬과 왕복한다', (contract, key, direction) => {
    expect(toTableSort(contract)).toEqual({ key, direction });
    expect(toLotStatusSort({ key, direction })).toBe(contract);
  });

  it('정렬 해제나 계약 밖 열은 서버 기본 정렬로 되돌린다', () => {
    expect(toLotStatusSort(null)).toBe('latestTransitionDesc');
    expect(toLotStatusSort({ key: 'onHandQty', direction: 'ascending' })).toBe(
      'latestTransitionDesc',
    );
  });
});
