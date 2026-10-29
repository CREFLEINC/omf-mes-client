import { describe, expect, it } from 'vitest';

import { moveKey, orderColumns } from './column-grip-order';

const columns = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

describe('orderColumns', () => {
  it('저장된 순서가 없으면 기본 순서다', () => {
    expect(orderColumns(columns, []).map(({ key }) => key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('저장된 순서로 세우고, 사라진 열은 버리고, 새 열은 뒤에 붙인다', () => {
    expect(orderColumns(columns, ['c', 'x', 'a']).map(({ key }) => key)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });
});

describe('moveKey', () => {
  it('오른쪽으로 끌면 놓은 열의 뒤에 선다', () => {
    expect(moveKey(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('왼쪽으로 끌면 놓은 열의 앞에 선다', () => {
    expect(moveKey(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('제자리나 모르는 열이면 그대로다', () => {
    expect(moveKey(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'a', 'z')).toEqual(['a', 'b']);
  });
});
