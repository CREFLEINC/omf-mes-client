import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SORT,
  isSortKeyAllowed,
  isWidePeriod,
  parseSort,
  SORT_KEYS,
  toSortParam,
} from './sort';

const NARROW = { from: '2026-08-01', to: '2026-08-30' };
const WIDE = { from: '2026-01-01', to: '2026-12-31' };
const BLOCKED = { from: '', to: '' };

describe('정렬 키 제한 — L-4', () => {
  it.each(SORT_KEYS.filter((key) => key !== 'achievementRate'))(
    '지정된 열 %s 로 정렬한다',
    (key) => {
      expect(parseSort(`${key},desc`, NARROW)).toEqual({ key, direction: 'desc' });
    },
  );

  /* ⛔ 인덱스 없는 열에서 전체 정렬이 돌면 목록이 멎는다 — 지정된 열만 통과시킨다. */
  it.each([
    ['지정 밖의 열', 'remarks,asc'],
    ['없는 열', 'hold_qty,desc'],
    ['빈 값', ''],
    ['값 없음', null],
  ])('⛔ %s 이면 기본 순서로 되돌린다', (_name, raw) => {
    expect(parseSort(raw, NARROW)).toEqual(DEFAULT_SORT);
  });

  /*
   * 막는 것은 «열»이지 방향이 아니다. 열이 허용된 값이면 방향이 없거나 이상해도 그 열의
   * 오름차순으로 둔다 — 기본 순서로 되돌리면 사용자가 고른 열이 이유 없이 사라진다.
   */
  it.each([
    ['방향이 없음', 'workOrderNo'],
    ['방향이 이상함', 'workOrderNo,sideways'],
  ])('%s 이면 그 열의 오름차순으로 둔다', (_name, raw) => {
    expect(parseSort(raw, NARROW)).toEqual({ key: 'workOrderNo', direction: 'asc' });
  });

  it('기본 순서가 계약의 기본값과 같다', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'priorityNo', direction: 'asc' });
  });
});

describe('달성률만 조건이 붙는다 — 파생이라 정렬이 비싸다', () => {
  it('기간이 좁으면 허용한다', () => {
    expect(isSortKeyAllowed('achievementRate', NARROW)).toBe(true);
    expect(parseSort('achievementRate,desc', NARROW).key).toBe('achievementRate');
  });

  it('⛔ 기간이 넓으면 막고 기본 순서로 되돌린다', () => {
    expect(isSortKeyAllowed('achievementRate', WIDE)).toBe(false);
    expect(parseSort('achievementRate,desc', WIDE)).toEqual(DEFAULT_SORT);
  });

  it('다른 열은 넓은 기간에서도 그대로 허용한다', () => {
    for (const key of SORT_KEYS.filter((candidate) => candidate !== 'achievementRate')) {
      expect(isSortKeyAllowed(key, WIDE)).toBe(true);
    }
  });

  /*
   * ⛔ 막힌 기간을 「넓다」로 보면, 기간을 채우기도 «전»에 정렬이 사라진다.
   * 조회가 안 나가는 상태에서는 정렬을 따질 자리가 없다.
   */
  it('⛔ 막힌 기간은 「넓다」로 보지 않는다', () => {
    expect(isWidePeriod(BLOCKED)).toBe(false);
    expect(isSortKeyAllowed('achievementRate', BLOCKED)).toBe(true);
  });

  it('넓고 좁음의 경계가 기간 경고와 같은 수다 — 두 말이 어긋나지 않게', () => {
    expect(isWidePeriod(NARROW)).toBe(false);
    expect(isWidePeriod(WIDE)).toBe(true);
  });
});

describe('toSortParam', () => {
  it('「열,방향」 한 문자열로 만든다', () => {
    expect(toSortParam({ key: 'workOrderNo', direction: 'desc' }, NARROW)).toBe('workOrderNo,desc');
  });

  /* 문이 둘이어야 하나가 무너져도 남는다 — 주소를 손으로 고쳐 넣는 길이 있다. */
  it('⛔ 넓은 기간에 달성률 정렬이 들어와도 기본 순서로 나간다', () => {
    expect(toSortParam({ key: 'achievementRate', direction: 'desc' }, WIDE)).toBe('priorityNo,asc');
  });

  it('기간이 좁으면 달성률 정렬을 그대로 내보낸다', () => {
    expect(toSortParam({ key: 'achievementRate', direction: 'desc' }, NARROW)).toBe(
      'achievementRate,desc',
    );
  });
});
