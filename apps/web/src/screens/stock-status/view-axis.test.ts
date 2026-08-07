import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VIEW,
  VIEW_AXES,
  groupAxisOf,
  readViewAxis,
  toGroupByQuery,
  type ViewAxis,
} from './view-axis';

describe('readViewAxis — 주소가 담은 보기', () => {
  it('세 값을 그대로 읽는다', () => {
    expect(readViewAxis('item')).toBe('item');
    expect(readViewAxis('lot')).toBe('lot');
    expect(readViewAxis('location')).toBe('location');
  });

  /*
   * 주소는 손으로 고쳐지는 자리다. 모르는 값을 그대로 요청에 실으면 계약 열거값 밖이라
   * 조회 전체가 400으로 죽고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('모르는 값·빈 값·없는 키는 품목별로 읽는다', () => {
    expect(readViewAxis('xyz')).toBe(DEFAULT_VIEW);
    expect(readViewAxis('')).toBe(DEFAULT_VIEW);
    expect(readViewAxis(null)).toBe(DEFAULT_VIEW);
    expect(readViewAxis('ITEM')).toBe(DEFAULT_VIEW);
  });

  it('기본 보기가 품목별이다', () => {
    expect(DEFAULT_VIEW).toBe('item');
  });

  it('보기 목록의 순서가 탭 순서다', () => {
    expect(VIEW_AXES).toEqual(['item', 'lot', 'location']);
  });
});

describe('toGroupByQuery — 보기를 계약 파라미터로', () => {
  /* 계약 기본값이 `ITEM`이라 싣지 않는다. 기본값을 실으면 요청 URL이 두 가지가 된다. */
  it('품목별은 groupBy를 만들지 않는다', () => {
    expect(toGroupByQuery('item')).toEqual({});
    expect(Object.hasOwn(toGroupByQuery('item'), 'groupBy')).toBe(false);
  });

  it('LOT별·위치별은 계약 열거값을 싣는다', () => {
    expect(toGroupByQuery('lot')).toEqual({ groupBy: 'LOT' });
    expect(toGroupByQuery('location')).toEqual({ groupBy: 'LOCATION' });
  });

  /* 모르는 값이 여기까지 오면 `readViewAxis`가 새는 것이다 — 그래도 계약 밖 값을 만들지 않는다. */
  it('세 보기 밖의 값을 만들어 내지 않는다', () => {
    const allowed = new Set(['LOT', 'LOCATION']);

    for (const view of VIEW_AXES) {
      const query = toGroupByQuery(view);

      if (query.groupBy !== undefined) expect(allowed.has(query.groupBy)).toBe(true);
    }
  });
});

describe('groupAxisOf — 1단 그룹 헤더의 축', () => {
  /* 품목별은 행 하나가 곧 품목이라 묶을 것이 없다. 묶으면 그룹마다 행이 하나씩 남는다. */
  it('품목별에는 그룹 축이 없다', () => {
    expect(groupAxisOf('item')).toBeNull();
  });

  it('LOT별은 품목으로, 위치별은 위치로 묶는다', () => {
    expect(groupAxisOf('lot')).toBe('item');
    expect(groupAxisOf('location')).toBe('location');
  });

  /*
   * **중첩 그룹을 만들지 않는다**(이슈 #21 §4 미결 4). 축이 하나뿐임을 값으로 고정한다 —
   * 배열이나 목록이 되면 다단 트리가 슬그머니 들어올 자리가 생긴다.
   */
  it('그룹 축이 언제나 하나이거나 없다', () => {
    const axes: (string | null)[] = VIEW_AXES.map((view: ViewAxis) => groupAxisOf(view));

    for (const axis of axes) {
      expect(axis === null || typeof axis === 'string').toBe(true);
    }
  });
});
