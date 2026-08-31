import { describe, expect, it } from 'vitest';

import { groupAxisOf, readViewAxis, resolveViewAxis, toGroupByQuery } from './view-axis';

describe('readViewAxis', () => {
  it('모르는 값은 기본 보기(품목별)로 읽는다', () => {
    expect(readViewAxis('nope')).toBe('item');
    expect(readViewAxis(null)).toBe('item');
  });

  it('알려진 값은 그대로 읽는다', () => {
    expect(readViewAxis('lot')).toBe('lot');
    expect(readViewAxis('location')).toBe('location');
  });
});

describe('resolveViewAxis', () => {
  it('LOT별 보기는 품목이 있어야 성립한다', () => {
    expect(resolveViewAxis('lot', false)).toBe('item');
    expect(resolveViewAxis('lot', true)).toBe('lot');
  });

  it('LOT별이 아닌 보기는 품목 유무와 무관하다', () => {
    expect(resolveViewAxis('location', false)).toBe('location');
  });
});

describe('toGroupByQuery', () => {
  it('품목별은 키 자체를 만들지 않는다', () => {
    expect(toGroupByQuery('item')).toEqual({});
  });

  it('LOT별·위치별은 groupBy를 싣는다', () => {
    expect(toGroupByQuery('lot')).toEqual({ groupBy: 'LOT' });
    expect(toGroupByQuery('location')).toEqual({ groupBy: 'LOCATION' });
  });
});

describe('groupAxisOf', () => {
  it('품목별에는 그룹 헤더가 없다', () => {
    expect(groupAxisOf('item')).toBeNull();
  });

  it('LOT별은 품목으로, 위치별은 위치로 묶는다', () => {
    expect(groupAxisOf('lot')).toBe('item');
    expect(groupAxisOf('location')).toBe('location');
  });
});
