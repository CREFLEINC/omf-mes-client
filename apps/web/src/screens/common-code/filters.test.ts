import { describe, expect, it } from 'vitest';

import {
  clearFilter,
  clearScopedFilter,
  hasAnyFilter,
  hasAnyScopedFilter,
  readCodeGroupFilters,
  readPage,
  readScopedFilters,
  readSelectedId,
  toCodeGroupListQuery,
  toDepartmentListQuery,
  toFilterChips,
  toScopedFilterChips,
  toScopedSearchParams,
  toSearchParams,
  toWorkerListQuery,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readCodeGroupFilters', () => {
  it('주소에서 조건을 읽는다', () => {
    expect(readCodeGroupFilters(params('?q=SYN&inactive=1'))).toEqual({
      q: 'SYN',
      includeInactive: true,
    });
  });

  it('조건이 없으면 빈 조건이다', () => {
    expect(readCodeGroupFilters(params(''))).toEqual({ q: '', includeInactive: false });
  });

  /* 켜짐을 나타내는 값은 하나뿐이다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
  it('미사용 포함은 1일 때만 켜진 것으로 본다', () => {
    expect(readCodeGroupFilters(params('?inactive=true')).includeInactive).toBe(false);
    expect(readCodeGroupFilters(params('?inactive=0')).includeInactive).toBe(false);
    expect(readCodeGroupFilters(params('?inactive=')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it('주소의 쪽 번호를 읽는다', () => {
    expect(readPage(params('?page=3'))).toBe(3);
  });

  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('이상한 값이면 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(params('?page=0'))).toBe(1);
    expect(readPage(params('?page=-2'))).toBe(1);
    expect(readPage(params('?page=1.5'))).toBe(1);
    expect(readPage(params('?page=abc'))).toBe(1);
  });
});

/*
 * 선택 번호는 네 자리(`grp`·`val`·`dep`·`wkr`)에서 같은 규칙으로 읽는다 —
 * 자리마다 따로 해석하면 한 자리만 규칙이 어긋나도 드러나지 않는다.
 */
describe('readSelectedId', () => {
  it('주소의 선택 번호를 읽는다', () => {
    expect(readSelectedId(params('?grp=1001'), 'grp')).toBe(1001);
    expect(readSelectedId(params('?dep=1001&wkr=2002'), 'wkr')).toBe(2002);
  });

  it('없으면 고르지 않은 것이다', () => {
    expect(readSelectedId(params(''), 'grp')).toBeNull();
    expect(readSelectedId(params('?grp='), 'grp')).toBeNull();
  });

  /* 식별자는 1부터 매겨진다 — 0·음수·소수·문자는 어떤 자원도 가리키지 않는다. */
  it('양의 정수가 아니면 고르지 않은 것으로 본다', () => {
    expect(readSelectedId(params('?grp=0'), 'grp')).toBeNull();
    expect(readSelectedId(params('?grp=-3'), 'grp')).toBeNull();
    expect(readSelectedId(params('?grp=1.5'), 'grp')).toBeNull();
    expect(readSelectedId(params('?grp=abc'), 'grp')).toBeNull();
    expect(readSelectedId(params('?grp=12abc'), 'grp')).toBeNull();
  });
});

describe('readScopedFilters', () => {
  it('조직 탭은 사업부를, 작업자 탭은 부서를 선택 축으로 읽는다', () => {
    expect(readScopedFilters(params('?q=SYN&bu=1001&inactive=1'), 'bu')).toEqual({
      q: 'SYN',
      scopeId: '1001',
      includeInactive: true,
    });
    expect(readScopedFilters(params('?q=SYN&dept=2002'), 'dept')).toEqual({
      q: 'SYN',
      scopeId: '2002',
      includeInactive: false,
    });
  });

  it('조건이 없으면 빈 조건이다', () => {
    expect(readScopedFilters(params(''), 'bu')).toEqual({
      q: '',
      scopeId: '',
      includeInactive: false,
    });
  });

  /* 다른 탭의 선택 축 키를 읽지 않는다 — 읽으면 탭 사이로 조건이 샌다. */
  it('자기 탭의 선택 축만 읽는다', () => {
    expect(readScopedFilters(params('?dept=2002'), 'bu').scopeId).toBe('');
  });

  /*
   * 선택 축도 **선택 번호와 같은 규칙**으로 거른다. 이 값은 그대로 `Number()`를 거쳐
   * 계약 쿼리로 나가므로, 걸러 내지 않으면 `?bu=abc`가 `businessUnitId=NaN`을 서버로 보낸다.
   */
  it('양의 정수가 아닌 선택 축은 「전체」로 본다', () => {
    expect(readScopedFilters(params('?bu=0'), 'bu').scopeId).toBe('');
    expect(readScopedFilters(params('?bu=-3'), 'bu').scopeId).toBe('');
    expect(readScopedFilters(params('?bu=1.5'), 'bu').scopeId).toBe('');
    expect(readScopedFilters(params('?bu=abc'), 'bu').scopeId).toBe('');
    expect(readScopedFilters(params('?bu=12abc'), 'bu').scopeId).toBe('');
  });

  it('걸러 낸 선택 축은 계약 쿼리에도 실리지 않는다', () => {
    const filters = readScopedFilters(params('?bu=abc'), 'bu');

    expect('businessUnitId' in toDepartmentListQuery(filters, 1)).toBe(false);
  });

  it('작업자 탭의 선택 축도 같은 규칙을 쓴다', () => {
    expect(readScopedFilters(params('?dept=abc'), 'dept').scopeId).toBe('');
    expect(readScopedFilters(params('?dept=3001'), 'dept').scopeId).toBe('3001');
  });
});

describe('toScopedSearchParams', () => {
  it('빈 조건과 첫 쪽은 키 자체를 두지 않는다', () => {
    const next = toScopedSearchParams(
      'org',
      'bu',
      { q: '', scopeId: '', includeInactive: false },
      1,
    );

    expect([...next.keys()]).toEqual(['tab']);
    expect(next.get('tab')).toBe('org');
  });

  it('걸린 조건과 두 번째 이후 쪽만 싣는다', () => {
    const next = toScopedSearchParams(
      'worker',
      'dept',
      { q: 'SYN', scopeId: '2002', includeInactive: true },
      4,
    );

    expect(next.get('q')).toBe('SYN');
    expect(next.get('dept')).toBe('2002');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('4');
  });

  it('선택 파라미터를 담지 않는다', () => {
    const next = toScopedSearchParams(
      'org',
      'bu',
      { q: 'SYN', scopeId: '1001', includeInactive: true },
      2,
    );

    for (const key of ['dep', 'wkr', 'grp', 'val', 'new']) {
      expect(next.has(key)).toBe(false);
    }
  });
});

describe('toDepartmentListQuery', () => {
  it('빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다', () => {
    expect(toDepartmentListQuery({ q: '', scopeId: '', includeInactive: false }, 1)).toEqual({});
  });

  it('걸린 조건만 계약 이름으로 싣는다', () => {
    expect(toDepartmentListQuery({ q: 'SYN', scopeId: '1001', includeInactive: true }, 2)).toEqual({
      q: 'SYN',
      businessUnitId: 1001,
      includeInactive: true,
      page: 2,
    });
  });
});

describe('toWorkerListQuery', () => {
  it('걸린 조건만 계약 이름으로 싣는다', () => {
    expect(toWorkerListQuery({ q: 'SYN', scopeId: '2002', includeInactive: true }, 3)).toEqual({
      q: 'SYN',
      departmentId: 2002,
      includeInactive: true,
      page: 3,
    });
  });

  /* 공장·사업부 필터를 만들지 않았다 — 화면에 없는 조건을 요청에 실으면 되돌릴 수단이 없다. */
  it('공장·사업부를 싣지 않는다', () => {
    const query = toWorkerListQuery({ q: 'SYN', scopeId: '2002', includeInactive: false }, 1);

    expect('plantId' in query).toBe(false);
    expect('businessUnitId' in query).toBe(false);
  });
});

describe('toScopedFilterChips', () => {
  const labels = {
    keyword: (value: string) => `검색어: ${value}`,
    keywordRemove: '검색어 조건 제거',
    scope: (label: string) => `사업부: ${label}`,
    scopeRemove: '사업부 조건 제거',
    includeInactiveRemove: '미사용 포함 조건 제거',
  };

  it('걸린 조건마다 칩 하나가 나온다', () => {
    const chips = toScopedFilterChips(
      { q: 'SYN', scopeId: '1001', includeInactive: true },
      () => '제조사업부',
      labels,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'scopeId', 'includeInactive']);
    expect(chips[1]?.label).toBe('사업부: 제조사업부');
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(
      toScopedFilterChips({ q: '', scopeId: '', includeInactive: false }, () => '', labels),
    ).toEqual([]);
  });

  it('칩마다 제거 버튼의 접근 이름이 다르다', () => {
    const chips = toScopedFilterChips(
      { q: 'SYN', scopeId: '1001', includeInactive: true },
      () => '제조사업부',
      labels,
    );
    const removeLabels = chips.map((chip) => chip.removeLabel);

    expect(new Set(removeLabels).size).toBe(removeLabels.length);
  });
});

describe('hasAnyScopedFilter · clearScopedFilter', () => {
  it('조건이 하나라도 있으면 참이다', () => {
    expect(hasAnyScopedFilter({ q: '', scopeId: '1001', includeInactive: false })).toBe(true);
    expect(hasAnyScopedFilter({ q: '', scopeId: '', includeInactive: false })).toBe(false);
  });

  it('조건 하나만 푼다 — 키마다 「비었다」의 표현이 다르다', () => {
    const filters = { q: 'SYN', scopeId: '1001', includeInactive: true };

    expect(clearScopedFilter(filters, 'scopeId')).toEqual({ ...filters, scopeId: '' });
    expect(clearScopedFilter(filters, 'includeInactive')).toEqual({
      ...filters,
      includeInactive: false,
    });
    expect(clearScopedFilter(filters, 'q')).toEqual({ ...filters, q: '' });
  });
});

describe('toSearchParams', () => {
  it('빈 조건과 첫 쪽은 키 자체를 두지 않는다', () => {
    const next = toSearchParams('code', { q: '', includeInactive: false }, 1);

    expect(next.get('tab')).toBe('code');
    expect([...next.keys()]).toEqual(['tab']);
  });

  it('걸린 조건과 두 번째 이후 쪽만 싣는다', () => {
    const next = toSearchParams('code', { q: 'SYN', includeInactive: true }, 3);

    expect(next.get('q')).toBe('SYN');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('3');
  });

  /*
   * 조건·쪽이 바뀌면 이 함수의 결과로 주소를 통째로 갈아 끼운다 —
   * 선택을 담지 않으므로 보이는 행이 달라질 때 선택이 자연히 사라진다.
   */
  it('선택 파라미터를 담지 않는다', () => {
    const next = toSearchParams('code', { q: 'SYN', includeInactive: true }, 2);

    for (const key of ['grp', 'val', 'vpage', 'vinactive', 'new']) {
      expect(next.has(key)).toBe(false);
    }
  });
});

describe('toCodeGroupListQuery', () => {
  it('빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다', () => {
    expect(toCodeGroupListQuery({ q: '', includeInactive: false }, 1)).toEqual({});
  });

  it('걸린 조건만 싣는다', () => {
    expect(toCodeGroupListQuery({ q: 'SYN', includeInactive: true }, 2)).toEqual({
      q: 'SYN',
      includeInactive: true,
      page: 2,
    });
  });

  /* 계약의 기본값이 false다 — 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('미사용 포함이 꺼져 있으면 키 자체가 없다', () => {
    expect('includeInactive' in toCodeGroupListQuery({ q: 'SYN', includeInactive: false }, 1)).toBe(
      false,
    );
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나가 나온다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'includeInactive']);
    expect(chips[0]?.label).toBe('검색어: SYN');
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips({ q: '', includeInactive: false })).toEqual([]);
  });

  it('칩마다 제거 버튼의 접근 이름이 다르다 — 어느 조건을 푸는지 알 수 있다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).not.toBe('');
  });
});

describe('hasAnyFilter', () => {
  it('조건이 하나라도 있으면 참이다', () => {
    expect(hasAnyFilter({ q: 'SYN', includeInactive: false })).toBe(true);
    expect(hasAnyFilter({ q: '', includeInactive: true })).toBe(true);
    expect(hasAnyFilter({ q: '', includeInactive: false })).toBe(false);
  });
});

describe('clearFilter', () => {
  it('검색어만 푼다', () => {
    expect(clearFilter({ q: 'SYN', includeInactive: true }, 'q')).toEqual({
      q: '',
      includeInactive: true,
    });
  });

  it('미사용 포함만 푼다 — 키마다 「비었다」의 표현이 다르다', () => {
    expect(clearFilter({ q: 'SYN', includeInactive: true }, 'includeInactive')).toEqual({
      q: 'SYN',
      includeInactive: false,
    });
  });
});
