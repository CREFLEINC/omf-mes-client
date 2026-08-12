import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  clearFilter,
  isCreating,
  readFilters,
  readPage,
  readSelectedRouteId,
  toCreateSearchParams,
  toFilterChips,
  toRouteListQuery,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
} from './filters';
import type { RouteFilters } from './types';

/**
 * 조회 조건 — 주소가 정본이다.
 *
 * **이 파일의 중심은 `activeOnly`의 방향 뒤집기다.** 화면 어휘(「미사용 포함」)와 계약
 * 파라미터(`activeOnly`)가 서로 반대라, 뒤집는 자리가 하나여야 하고 그 자리가 검사돼야 한다.
 */

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (patch: Partial<RouteFilters> = {}): RouteFilters => ({
  ...DEFAULT_FILTERS,
  ...patch,
});

describe('readFilters', () => {
  it('네 조건을 주소에서 읽는다', () => {
    expect(readFilters(params('?ty=SAMPLE-TYPE-A&bu=9101&inactive=1&q=SAMPLE'))).toEqual({
      approvalTypeCode: 'SAMPLE-TYPE-A',
      businessUnitId: '9101',
      includeInactive: true,
      q: 'SAMPLE',
    });
  });

  it('조건이 없으면 기본값이다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
  });

  it.each(['abc', '0', '-1', '1.5', ''])('식별자가 아닌 사업부(%s)는 「전체」로 본다', (raw) => {
    expect(readFilters(params(`?bu=${raw}`)).businessUnitId).toBe('');
  });

  it('「미사용 포함」은 1일 때만 켜진다', () => {
    expect(readFilters(params('?inactive=1')).includeInactive).toBe(true);
    expect(readFilters(params('?inactive=true')).includeInactive).toBe(false);
    expect(readFilters(params('?inactive=0')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it.each(['0', '-1', 'abc', '1.5', ''])('쪽으로 쓸 수 없는 값(%s)은 첫 쪽이다', (raw) => {
    expect(readPage(params(`?page=${raw}`))).toBe(1);
  });

  it('정수 쪽 번호를 그대로 읽는다', () => {
    expect(readPage(params('?page=3'))).toBe(3);
  });
});

describe('readSelectedRouteId · isCreating', () => {
  it('정수 번호만 선택으로 읽는다', () => {
    expect(readSelectedRouteId(params('?ar=9001'))).toBe(9001);
  });

  it.each(['xyz', '0', '-1', ''])('식별자가 아닌 선택(%s)은 고르지 않은 것이다', (raw) => {
    expect(readSelectedRouteId(params(`?ar=${raw}`))).toBeNull();
  });

  it('등록 중이면 아무것도 고르지 않은 것이다', () => {
    // 두 자리가 함께 서지 않는다 — 배타 규칙이 이 함수 하나에만 있어야 한다.
    expect(readSelectedRouteId(params('?ar=9001'))).toBe(9001);
    expect(readSelectedRouteId(params('?ar=9001&new=1'))).toBeNull();
    expect(isCreating(params('?ar=9001&new=1'))).toBe(true);
  });

  it('등록 표시는 1일 때만 참이다', () => {
    expect(isCreating(params('?new=1'))).toBe(true);
    expect(isCreating(params('?new=true'))).toBe(false);
    expect(isCreating(params(''))).toBe(false);
  });
});

describe('toSearchParams', () => {
  it('걸린 조건만 주소에 담는다', () => {
    const next = toSearchParams(
      filters({ approvalTypeCode: 'SAMPLE-TYPE-A', businessUnitId: '9101', includeInactive: true }),
      1,
    );

    expect(next.get('ty')).toBe('SAMPLE-TYPE-A');
    expect(next.get('bu')).toBe('9101');
    expect(next.get('inactive')).toBe('1');
    expect(next.has('q')).toBe(false);
  });

  it('공백만인 검색어는 주소에 담지 않는다', () => {
    expect(toSearchParams(filters({ q: '   ' }), 1).has('q')).toBe(false);
    expect(toSearchParams(filters({ q: ' SAMPLE ' }), 1).get('q')).toBe('SAMPLE');
  });

  it('첫 쪽은 주소에 적지 않는다', () => {
    expect(toSearchParams(filters(), 1).has('page')).toBe(false);
    expect(toSearchParams(filters(), 4).get('page')).toBe('4');
  });

  it('선택 자리를 만들지 않는다', () => {
    // 조건·쪽이 바뀌면 보이는 행이 달라진다 — 이 결과로 주소를 갈아 끼우면 선택이 자연히 사라진다.
    const next = toSearchParams(filters({ q: 'SAMPLE' }), 2);

    expect(next.get('q')).toBe('SAMPLE');
    expect(next.has('ar')).toBe(false);
    expect(next.has('new')).toBe(false);
  });
});

describe('toSelectionSearchParams', () => {
  it('조건과 쪽을 그대로 두고 선택만 얹는다', () => {
    const next = toSelectionSearchParams(filters({ q: 'SAMPLE' }), 3, 9001);

    expect(next.get('q')).toBe('SAMPLE');
    expect(next.get('page')).toBe('3');
    expect(next.get('ar')).toBe('9001');
  });

  it('선택을 풀면 그 자리만 사라진다', () => {
    const next = toSelectionSearchParams(filters({ q: 'SAMPLE' }), 3, null);

    expect(next.get('q')).toBe('SAMPLE');
    expect(next.has('ar')).toBe(false);
  });

  it('등록 중 표시를 남기지 않는다', () => {
    // 두 자리가 함께 서지 않는다 — 주소를 만드는 쪽도 그 규칙을 지킨다.
    expect(toSelectionSearchParams(filters(), 1, 9001).has('new')).toBe(false);
  });
});

describe('toCreateSearchParams', () => {
  it('조건과 쪽을 그대로 두고 등록 표시만 얹는다', () => {
    const next = toCreateSearchParams(filters({ q: 'SAMPLE' }), 3);

    expect(next.get('q')).toBe('SAMPLE');
    expect(next.get('page')).toBe('3');
    expect(next.get('new')).toBe('1');
  });

  it('고른 결재선을 남기지 않는다', () => {
    // 두 자리는 함께 서지 않는다 — 주소를 만드는 쪽도 그 규칙을 지킨다.
    expect(toCreateSearchParams(filters(), 1).has('ar')).toBe(false);
  });

  it('등록 표시가 켜지면 고른 결재선이 없는 것으로 읽힌다', () => {
    // 짝 방향 — 만드는 쪽과 읽는 쪽이 같은 규칙을 갖는지까지 잰다.
    const next = toCreateSearchParams(filters(), 1);

    expect(isCreating(next)).toBe(true);
    expect(readSelectedRouteId(next)).toBeNull();
  });
});

describe('withoutSelection', () => {
  it('선택 자리만 걷어 낸다', () => {
    const next = withoutSelection(new URLSearchParams('q=SAMPLE&page=3&ar=9001'));

    expect(next.has('ar')).toBe(false);
    expect(next.get('q')).toBe('SAMPLE');
    expect(next.get('page')).toBe('3');
  });

  it('원래 주소를 고치지 않는다', () => {
    const original = new URLSearchParams('ar=9001');

    withoutSelection(original);

    expect(original.get('ar')).toBe('9001');
  });

  it('선택이 없어도 그대로 둔다', () => {
    expect(withoutSelection(new URLSearchParams('q=SAMPLE')).get('q')).toBe('SAMPLE');
  });
});

describe('toRouteListQuery', () => {
  it('「미사용 포함」이 꺼지면 activeOnly=true다', () => {
    expect(toRouteListQuery(filters({ includeInactive: false }), 1).activeOnly).toBe(true);
  });

  it('「미사용 포함」이 켜지면 activeOnly=false다', () => {
    expect(toRouteListQuery(filters({ includeInactive: true }), 1).activeOnly).toBe(false);
  });

  it('activeOnly를 어느 경우에도 빼지 않는다', () => {
    // 계약에 기본값이 없다 — 생략하면 서버가 무엇을 내리는지 정해져 있지 않다.
    for (const includeInactive of [true, false]) {
      expect(Object.keys(toRouteListQuery(filters({ includeInactive }), 1))).toContain(
        'activeOnly',
      );
    }
  });

  it('빈 조건은 키 자체를 싣지 않는다', () => {
    const query = toRouteListQuery(filters(), 1);

    expect(query).toEqual({ activeOnly: true });
  });

  it('사업부를 숫자로 싣고, 식별자가 아니면 싣지 않는다', () => {
    expect(toRouteListQuery(filters({ businessUnitId: '9101' }), 1).businessUnitId).toBe(9101);
    expect(toRouteListQuery(filters({ businessUnitId: '' }), 1).businessUnitId).toBeUndefined();
  });

  it('공백만인 검색어를 싣지 않는다', () => {
    expect(toRouteListQuery(filters({ q: '   ' }), 1).q).toBeUndefined();
    expect(toRouteListQuery(filters({ q: ' SAMPLE ' }), 1).q).toBe('SAMPLE');
  });

  it('첫 쪽은 싣지 않는다', () => {
    expect(toRouteListQuery(filters(), 1).page).toBeUndefined();
    expect(toRouteListQuery(filters(), 2).page).toBe(2);
  });

  it('쪽 크기를 싣지 않는다', () => {
    // 서버 기본값을 쓴다 — 화면이 정한 크기를 심으면 그것이 계약처럼 굳는다.
    expect(Object.keys(toRouteListQuery(filters(), 2))).not.toContain('size');
  });
});

describe('toFilterChips', () => {
  const label = (businessUnitId: string): string => `합성사업부${businessUnitId}`;

  it('걸린 조건마다 칩 하나를 낸다', () => {
    const chips = toFilterChips(
      filters({
        approvalTypeCode: 'SAMPLE-TYPE-A',
        businessUnitId: '9101',
        includeInactive: true,
        q: 'SAMPLE',
      }),
      label,
    );

    expect(chips.map((chip) => chip.key)).toEqual([
      'approvalTypeCode',
      'businessUnitId',
      'q',
      'includeInactive',
    ]);
  });

  it('사업부 칩에 번호가 아니라 이름을 담는다', () => {
    const chips = toFilterChips(filters({ businessUnitId: '9101' }), label);

    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toContain('합성사업부9101');
    expect(chips[0]?.removeLabel).toBe(messages.approvalRoute.filters.chipRemoveBusinessUnit);
  });

  it('「미사용 포함」 칩은 공용 문구를 쓴다', () => {
    const chips = toFilterChips(filters({ includeInactive: true }), label);

    expect(chips[0]?.label).toBe(messages.common.includeInactive);
  });

  it('공백만인 검색어는 칩이 되지 않는다', () => {
    expect(toFilterChips(filters({ q: '   ' }), label)).toHaveLength(0);
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, label)).toHaveLength(0);
  });
});

describe('clearFilter', () => {
  it('조건 하나만 푼다', () => {
    const applied = filters({ businessUnitId: '9101', includeInactive: true, q: 'SAMPLE' });

    expect(clearFilter(applied, 'includeInactive')).toEqual({ ...applied, includeInactive: false });
    expect(clearFilter(applied, 'q')).toEqual({ ...applied, q: '' });
    expect(clearFilter(applied, 'businessUnitId')).toEqual({ ...applied, businessUnitId: '' });
  });
});
