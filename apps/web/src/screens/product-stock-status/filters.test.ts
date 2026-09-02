import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSelectedLotId,
  SELECTION_KEYS,
  toBalanceFilterQuery,
  toFilterChips,
  toSearchParams,
} from './filters';

describe('readFilters', () => {
  it('빈 주소는 빈 조건으로 읽는다', () => {
    expect(readFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('0은 어느 자원의 번호도 아니라 버린다', () => {
    const params = new URLSearchParams('wh=0&item=0');

    expect(readFilters(params)).toEqual(EMPTY_FILTERS);
  });

  it('숫자가 아닌 값은 버린다', () => {
    const params = new URLSearchParams('wh=abc');

    expect(readFilters(params).warehouse).toBe('');
  });

  it('가용만은 정확한 표기 하나만 켠 것으로 읽는다', () => {
    expect(readFilters(new URLSearchParams('avail=true')).availableOnly).toBe(true);
    expect(readFilters(new URLSearchParams('avail=1')).availableOnly).toBe(false);
  });
});

describe('readSelectedLotId', () => {
  it('없으면 null이다', () => {
    expect(readSelectedLotId(new URLSearchParams())).toBeNull();
  });

  it('0은 LOT 번호로 받지 않는다', () => {
    expect(readSelectedLotId(new URLSearchParams('sel=0'))).toBeNull();
  });

  it('1 이상의 정수는 그대로 읽는다', () => {
    expect(readSelectedLotId(new URLSearchParams('sel=9401'))).toBe(9401);
  });
});

describe('readPage', () => {
  it('없거나 이상하면 첫 쪽이다', () => {
    expect(readPage(new URLSearchParams())).toBe(1);
    expect(readPage(new URLSearchParams('page=abc'))).toBe(1);
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
  });

  it('1 이상의 정수는 그대로 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });
});

describe('toBalanceFilterQuery', () => {
  it('빈 조건은 키를 싣지 않는다', () => {
    expect(toBalanceFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('창고·품목은 번호로 옮긴다', () => {
    const query = toBalanceFilterQuery({ warehouse: '9101', item: '9301', availableOnly: false });

    expect(query).toEqual({ warehouseId: 9101, itemId: 9301 });
  });

  it('가용만이 꺼져 있으면 inventoryStatusCode를 싣지 않는다', () => {
    expect(toBalanceFilterQuery(EMPTY_FILTERS).inventoryStatusCode).toBeUndefined();
  });

  it('가용만이 켜져 있으면 AVAILABLE을 싣는다', () => {
    const query = toBalanceFilterQuery({ ...EMPTY_FILTERS, availableOnly: true });

    expect(query.inventoryStatusCode).toBe('AVAILABLE');
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나를 낸다', () => {
    const filters = { warehouse: '9101', item: '', availableOnly: true };
    const chips = toFilterChips(filters, { warehouse: '합성 창고', item: '' });

    expect(chips.map((chip) => chip.key)).toEqual(['warehouse', 'availableOnly']);
  });

  it('아무 조건도 없으면 빈 배열이다', () => {
    expect(toFilterChips(EMPTY_FILTERS, { warehouse: '', item: '' })).toEqual([]);
  });
});

describe('toSearchParams', () => {
  it('기본값은 주소에 적지 않는다', () => {
    const params = toSearchParams('item', EMPTY_FILTERS, null, 1);

    expect(params.toString()).toBe('');
  });

  it('SELECTION_KEYS를 만들지 않는다', () => {
    const params = toSearchParams(
      'lot',
      { warehouse: '9101', item: '9301', availableOnly: true },
      'availableQty',
      2,
    );

    expect(params.has(SELECTION_KEYS.lot)).toBe(false);
  });

  it('채운 조건만 키가 실린다', () => {
    const params = toSearchParams(
      'location',
      { warehouse: '9101', item: '', availableOnly: false },
      null,
      1,
    );

    expect(params.get('wh')).toBe('9101');
    expect(params.get('view')).toBe('location');
    expect(params.has('item')).toBe(false);
    expect(params.has('avail')).toBe(false);
  });
});
