import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  readFilters,
  readPage,
  readSort,
  toListQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters', () => {
  /**
   * ⭐ 기본이 **켜짐**이다 — 적체 화면이다. 형제 화면들의 `params.get(key) === '1'` 한 줄을
   * 그대로 베끼면 기본값이 조용히 뒤집힌다.
   */
  it('키가 없으면 도래·열린 오더 없음이 켜져 있다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
    expect(readFilters(params('')).dueOnly).toBe(true);
    expect(readFilters(params('')).withoutOpenOrder).toBe(true);
  });

  it('모르는 값이면 기본값이다', () => {
    expect(readFilters(params('due=maybe')).dueOnly).toBe(true);
  });

  it('끄면 꺼진다', () => {
    expect(readFilters(params('due=0')).dueOnly).toBe(false);
  });

  it('모르는 정렬은 기본 정렬이다', () => {
    expect(readSort('SYN-UNKNOWN')).toBe(DEFAULT_SORT);
    expect(readSort('NEXT_PM_ASC')).toBe('NEXT_PM_ASC');
  });
});

describe('toSearchParams', () => {
  it('기본값과 같으면 싣지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).toString()).toBe('');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = {
      plant: '1001',
      dueOnly: false,
      withoutOpenOrder: false,
      guaranteedMissing: true,
      sort: 'CODE' as const,
    };
    const written = toSearchParams(filters, 3);

    expect(readFilters(written)).toEqual(filters);
    expect(readPage(written)).toBe(3);
  });
});

describe('toListQuery', () => {
  /**
   * ⭐ 계약이 이 파라미터를 **세 갈래**로 두었다 — 생략하면 거르지 않고, `false`면 없는 것만,
   * `true`면 있는 것만. 켠 상태에서 키를 빼면 거르지 않는 조회가 나가 **이미 오더가 나간
   * 툴이 목록에 섞인다.**
   */
  it('「열린 오더 없는 것만」을 false로 실어야 뜻이 선다', () => {
    expect(toListQuery(DEFAULT_FILTERS, 1).withOpenMaintenanceOrder).toBe(false);
  });

  it('끄면 키 자체를 싣지 않는다 — 그때는 거르지 않는 것이 맞다', () => {
    expect(toListQuery({ ...DEFAULT_FILTERS, withoutOpenOrder: false }, 1)).not.toHaveProperty(
      'withOpenMaintenanceOrder',
    );
  });

  /** ⭐ 서버 기본값이 코드 순이라 싣지 않으면 적체 화면이 아니게 된다. */
  it('정렬을 늘 싣는다', () => {
    expect(toListQuery(DEFAULT_FILTERS, 1).sort).toBe('SHOT_USAGE_DESC');
  });

  it('꺼진 boolean은 키 자체를 싣지 않는다', () => {
    expect(toListQuery({ ...DEFAULT_FILTERS, dueOnly: false }, 1)).not.toHaveProperty('pmDueOnly');
  });
});
