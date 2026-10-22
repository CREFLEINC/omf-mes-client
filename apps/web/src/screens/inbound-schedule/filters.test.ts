import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type ScheduleFilters,
} from './filters';

const t = messages.inboundSchedule;

const NO_PERIOD = { from: '', to: '' };

const filters = (overrides: Partial<ScheduleFilters> = {}): ScheduleFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

const NAMES = { supplier: '합성 공급사 가', plant: '합성 공장 가', item: '합성 품목 가' };

describe('readFilters', () => {
  /* 주소가 비어 있으면 화면 기본 — 미완료만 켬, 납기 지난 것만 끔. */
  it('빈 주소는 기본 조건이다', () => {
    expect(readFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it('주소의 조건을 그대로 읽는다', () => {
    expect(
      readFilters(
        new URLSearchParams('supplier=8101&plant=8201&item=8301&q=SAMPLE-PO&open=0&overdue=1'),
      ),
    ).toEqual({
      supplier: '8101',
      plant: '8201',
      item: '8301',
      q: 'SAMPLE-PO',
      openOnly: false,
      overdueOnly: true,
    });
  });

  /* 그대로 `Number()`에 넘기면 `NaN`이 요청에 실려 조회 전체가 400이 된다. */
  it.each(['abc', '1.5', '-3', '0', ''])('정수가 아닌 번호 %j 는 조건으로 받지 않는다', (raw) => {
    const read = readFilters(new URLSearchParams({ supplier: raw, plant: raw, item: raw }));

    expect([read.supplier, read.plant, read.item]).toEqual(['', '', '']);
  });

  /* 못 알아듣는 값은 기본으로 — 대상이 아닌 라인까지 보이는 것보다 놀랍지 않다. */
  it('알 수 없는 켜짐 표시는 기본으로 본다', () => {
    const read = readFilters(new URLSearchParams('open=no&overdue=yes'));

    expect(read.openOnly).toBe(true);
    expect(read.overdueOnly).toBe(false);
  });
});

describe('readPage', () => {
  it('이상한 쪽은 첫 쪽으로 본다', () => {
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readPage(new URLSearchParams('page=abc'))).toBe(1);
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });
});

describe('toSearchParams', () => {
  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 조건·첫 쪽이면 주소가 비어 있다', () => {
    expect(toSearchParams(NO_PERIOD, DEFAULT_FILTERS, 1, NO_PERIOD).toString()).toBe('');
  });

  it('미완료만 끔과 납기 지난 것만 켬만 적는다', () => {
    const params = toSearchParams(
      NO_PERIOD,
      filters({ openOnly: false, overdueOnly: true }),
      1,
      NO_PERIOD,
    );

    expect(params.get('open')).toBe('0');
    expect(params.get('overdue')).toBe('1');
  });

  it('채운 조건과 기간·쪽을 적고 검색어는 다듬는다', () => {
    const params = toSearchParams(
      { from: '2026-10-01', to: '' },
      filters({ supplier: '8101', plant: '8201', item: '8301', q: '  SAMPLE-PO  ' }),
      3,
      NO_PERIOD,
    );

    expect(params.toString()).toBe(
      'from=2026-10-01&supplier=8101&plant=8201&item=8301&q=SAMPLE-PO&page=3',
    );
  });

  /* 기본 기간과 같은 쪽은 적지 않고, 지운 쪽은 빈 값으로 적는다 — 다시 읽어도 지운 채다. */
  it('기간은 기본과 다를 때만 적고, 지운 기간은 빈 값으로 적는다', () => {
    const fallback = { from: '2026-10-07', to: '2026-11-04' };

    expect(toSearchParams(fallback, DEFAULT_FILTERS, 1, fallback).toString()).toBe('');
    expect(
      toSearchParams({ from: '', to: '2026-11-04' }, DEFAULT_FILTERS, 1, fallback).toString(),
    ).toBe('from=');
  });

  /* 주소를 손으로 고쳐 넣은 번호가 다시 주소에 남지 않게 한다. */
  it('정수가 아닌 번호는 주소에 적지 않는다', () => {
    expect(
      toSearchParams(NO_PERIOD, filters({ supplier: 'x' }), 1, NO_PERIOD).has('supplier'),
    ).toBe(false);
  });

  /* 조건을 실어 갈아 끼운 뒤 다시 읽으면 같은 조건이다 — 새로고침·공유가 같은 결과를 낸다. */
  it('주소로 옮겼다가 다시 읽으면 같은 조건이다', () => {
    const given = filters({ supplier: '8101', q: 'SAMPLE', openOnly: false, overdueOnly: true });

    expect(readFilters(toSearchParams(NO_PERIOD, given, 1, NO_PERIOD))).toEqual(given);
  });
});

describe('toFilterQuery', () => {
  /* 서버 기본(미완료만 켬 · 지연만 끔)과 같으면 싣지 않는다. */
  it('기본 조건이면 질의가 비어 있다', () => {
    expect(toFilterQuery(DEFAULT_FILTERS)).toEqual({});
  });

  it('번호 셋은 숫자로, 검색어는 다듬어 싣는다', () => {
    expect(
      toFilterQuery(filters({ supplier: '8101', plant: '8201', item: '8301', q: ' SAMPLE ' })),
    ).toEqual({ supplierId: 8101, plantId: 8201, itemId: 8301, q: 'SAMPLE' });
  });

  it('미완료만을 끄면 openOnly=false 를, 납기 지난 것만을 켜면 overdueOnly=true 를 싣는다', () => {
    expect(toFilterQuery(filters({ openOnly: false, overdueOnly: true }))).toEqual({
      openOnly: false,
      overdueOnly: true,
    });
  });

  it('공백만 친 검색어는 싣지 않는다', () => {
    expect(toFilterQuery(filters({ q: '   ' }))).toEqual({});
  });
});

describe('toFilterChips', () => {
  it('조건이 없으면 칩이 없다 — 켜짐 표시는 칩이 되지 않는다', () => {
    expect(toFilterChips(filters({ openOnly: false, overdueOnly: true }), NAMES)).toEqual([]);
  });

  it('걸린 조건마다 이름으로 칩을 만든다 — 번호를 문구로 만들지 않는다', () => {
    const chips = toFilterChips(
      filters({ supplier: '8101', plant: '8201', item: '8301', q: 'SAMPLE-PO' }),
      NAMES,
    );

    expect(chips.map((chip) => chip.label)).toEqual([
      t.filters.chipSupplier(NAMES.supplier),
      t.filters.chipPlant(NAMES.plant),
      t.filters.chipItem(NAMES.item),
      t.filters.chipQ('SAMPLE-PO'),
    ]);
    expect(JSON.stringify(chips)).not.toMatch(/8101|8201|8301/);
  });

  /* 「제거」가 넷이면 어느 조건을 푸는 것인지 알 수 없다. */
  it('제거 버튼의 접근 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({ supplier: '8101', plant: '8201', item: '8301', q: 'Q' }),
      NAMES,
    );

    expect(new Set(chips.map((chip) => chip.removeLabel)).size).toBe(4);
  });
});
