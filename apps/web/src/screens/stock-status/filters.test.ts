import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  hasAnyFilter,
  readFilters,
  readPage,
  toBalanceFilterQuery,
  toFilterChips,
  toSearchParams,
  type BalanceFilters,
  type FilterChipNames,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const NAMES: FilterChipNames = {
  warehouse: '합성 창고 가',
  item: '합성 품목 가',
  lot: '합성 LOT 가',
  location: '합성 위치 가',
};

const filters = (overrides: Partial<BalanceFilters> = {}): BalanceFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe('readFilters — 주소가 조건의 정본이다', () => {
  it('여덟 조건을 주소에서 읽는다', () => {
    const read = readFilters(
      params(
        'wh=9101&item=9301&lot=9401&loc=9201&qs=SAMPLE_Q_A&is=SAMPLE_I_A&own=SAMPLE_O_A&zero=true',
      ),
    );

    expect(read).toEqual({
      warehouse: '9101',
      item: '9301',
      lot: '9401',
      location: '9201',
      qualityStatus: 'SAMPLE_Q_A',
      inventoryStatus: 'SAMPLE_I_A',
      ownership: 'SAMPLE_O_A',
      includeZero: true,
    });
  });

  it('키가 하나도 없으면 빈 조건이다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  /*
   * 정수가 아닌 번호를 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
   * **조회 전체가 400으로 실패**하고 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 번호 조건은 버린다', () => {
    const read = readFilters(params('wh=abc&item=1.5&lot=-3&loc=%20'));

    expect(read.warehouse).toBe('');
    expect(read.item).toBe('');
    expect(read.lot).toBe('');
    expect(read.location).toBe('');
  });

  /* 계약 기본값이 거짓이다 — 참인 값 하나만 켠 것으로 읽는다. */
  it('잔액 0 포함은 true일 때만 켜진다', () => {
    expect(readFilters(params('zero=true')).includeZero).toBe(true);
    expect(readFilters(params('zero=false')).includeZero).toBe(false);
    expect(readFilters(params('zero=1')).includeZero).toBe(false);
    expect(readFilters(params('zero=')).includeZero).toBe(false);
  });

  /* 코드값은 값 목록이 확정되지 않았다 — 화면이 형태를 판정하지 않고 그대로 읽는다. */
  it('코드 조건은 형태를 판정하지 않고 그대로 읽는다', () => {
    expect(readFilters(params('qs=%EA%B0%80')).qualityStatus).toBe('가');
  });
});

describe('readPage — 주소가 가리키는 쪽', () => {
  it('1 이상의 정수만 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
    expect(readPage(params(''))).toBe(1);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-1'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
  });
});

describe('toSearchParams — 조건을 주소로', () => {
  it('채운 조건만 키가 생긴다', () => {
    const next = toSearchParams('item', filters({ warehouse: '9101' }), null, 1);

    expect(next.get('wh')).toBe('9101');
    expect(next.has('item')).toBe(false);
    expect(next.has('lot')).toBe(false);
    expect(next.has('zero')).toBe(false);
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 보기·첫 쪽·정렬 없음은 주소에 적지 않는다', () => {
    const next = toSearchParams('item', filters({ warehouse: '9101' }), null, 1);

    expect(next.has('view')).toBe(false);
    expect(next.has('page')).toBe(false);
    expect(next.has('sort')).toBe(false);
  });

  it('기본이 아닌 보기·쪽·정렬은 적는다', () => {
    const next = toSearchParams('location', filters({ warehouse: '9101' }), 'onHandQty', 3);

    expect(next.get('view')).toBe('location');
    expect(next.get('page')).toBe('3');
    expect(next.get('sort')).toBe('onHandQty');
  });

  it('잔액 0 포함은 켜졌을 때만 적는다', () => {
    expect(toSearchParams('item', filters({ includeZero: true }), null, 1).get('zero')).toBe(
      'true',
    );
    expect(toSearchParams('item', filters({ includeZero: false }), null, 1).has('zero')).toBe(
      false,
    );
  });

  /*
   * **`sel`·`hfrom`·`hto`·`tx`를 만들지 않는다.** 수명 표 1~5행이 이 한 가지로 함께 지켜진다 —
   * 조건·보기·정렬·쪽이 바뀌면 고른 LOT이 새 결과에 없을 수 있어 함께 비워져야 한다.
   * 고르는 쪽만 결과에 덧붙인다.
   */
  it('선택과 이력에 딸린 키를 만들지 않는다', () => {
    const next = toSearchParams('lot', filters({ warehouse: '9101', item: '9301' }), 'lotNo', 2);

    for (const key of ['sel', 'hfrom', 'hto', 'tx']) {
      expect(next.has(key)).toBe(false);
    }
  });

  /* 주소를 손으로 고친 경우가 이 자리다 — 되돌려 쓸 때도 다시 검사한다. */
  it('정수가 아닌 번호는 주소에도 다시 적지 않는다', () => {
    const next = toSearchParams('item', filters({ warehouse: 'abc', item: '1.5' }), null, 1);

    expect(next.has('wh')).toBe(false);
    expect(next.has('item')).toBe(false);
  });
});

describe('toBalanceFilterQuery — 계약이 쓰는 쿼리', () => {
  it('번호는 숫자로, 코드는 문자열로 싣는다', () => {
    const query = toBalanceFilterQuery(
      filters({
        warehouse: '9101',
        item: '9301',
        lot: '9401',
        location: '9201',
        qualityStatus: 'SAMPLE_Q_A',
        inventoryStatus: 'SAMPLE_I_A',
        ownership: 'SAMPLE_O_A',
      }),
    );

    expect(query).toEqual({
      warehouseId: 9101,
      itemId: 9301,
      lotId: 9401,
      locationId: 9201,
      qualityStatusCode: 'SAMPLE_Q_A',
      inventoryStatusCode: 'SAMPLE_I_A',
      ownershipTypeCode: 'SAMPLE_O_A',
    });
  });

  /* 계약 기본값이 거짓이라 실을 이유가 없다. 기본값을 실으면 요청 URL이 두 가지가 된다. */
  it('잔액 0 포함은 켜졌을 때만 싣는다', () => {
    expect(toBalanceFilterQuery(filters({ includeZero: true })).includeZero).toBe(true);
    expect(
      Object.hasOwn(toBalanceFilterQuery(filters({ includeZero: false })), 'includeZero'),
    ).toBe(false);
  });

  it('빈 조건은 키 자체를 만들지 않는다', () => {
    expect(toBalanceFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('정수가 아닌 번호는 요청에 싣지 않는다', () => {
    const query = toBalanceFilterQuery(filters({ warehouse: 'abc', item: '1.5' }));

    expect(Object.hasOwn(query, 'warehouseId')).toBe(false);
    expect(Object.hasOwn(query, 'itemId')).toBe(false);
  });
});

describe('toFilterChips — 적용된 조건마다 칩 하나', () => {
  it('걸린 조건만 칩이 된다', () => {
    const chips = toFilterChips(filters({ warehouse: '9101', includeZero: true }), NAMES);

    expect(chips.map((chip) => chip.key)).toEqual(['warehouse', 'includeZero']);
  });

  /*
   * **번호를 문구로 만드는 자리를 이 모듈에 두지 않는다**(#44). 참조 이름은 화면이 풀어 넘긴다 —
   * 만드는 자리가 없으면 내부 번호가 화면으로 샐 경로도 없다.
   */
  it('참조 조건의 칩에 이름이 실리고 번호가 실리지 않는다', () => {
    const chips = toFilterChips(filters({ warehouse: '9101', item: '9301' }), NAMES);
    const labels = chips.map((chip) => chip.label).join(' ');

    expect(labels).toContain('합성 창고 가');
    expect(labels).toContain('합성 품목 가');
    expect(labels).not.toContain('9101');
    expect(labels).not.toContain('9301');
  });

  it('제거 버튼의 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({
        warehouse: '9101',
        item: '9301',
        lot: '9401',
        location: '9201',
        qualityStatus: 'SAMPLE_Q_A',
        inventoryStatus: 'SAMPLE_I_A',
        ownership: 'SAMPLE_O_A',
        includeZero: true,
      }),
      NAMES,
    );

    expect(new Set(chips.map((chip) => chip.removeLabel)).size).toBe(chips.length);
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(EMPTY_FILTERS, NAMES)).toEqual([]);
  });
});

describe('hasAnyFilter', () => {
  it('하나라도 걸려 있으면 참이다', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasAnyFilter(filters({ warehouse: '9101' }))).toBe(true);
    expect(hasAnyFilter(filters({ includeZero: true }))).toBe(true);
  });
});
