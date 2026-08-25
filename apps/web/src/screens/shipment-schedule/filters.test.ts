import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type ShipmentFilters,
} from './filters';

const t = messages.shipmentSchedule;

const EMPTY_PERIOD = { from: '', to: '' };

const NAMES = { customer: '합성 고객 가', shipToPartner: '합성 납품처 가' };

const filters = (overrides: Partial<ShipmentFilters> = {}): ShipmentFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe('readFilters', () => {
  it('주소의 조건을 그대로 읽는다', () => {
    expect(
      readFilters(
        new URLSearchParams(
          'customer=9101&shipToPartner=9201&status=SAMPLE_STATUS_A&inspection=true',
        ),
      ),
    ).toEqual({
      customer: '9101',
      shipToPartner: '9201',
      status: 'SAMPLE_STATUS_A',
      inspection: 'true',
    });
  });

  it('키가 없으면 빈 조건이다', () => {
    expect(readFilters(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
  });

  it.each(['abc', '9101.5', '-1', '', ' ', '9101a'])(
    '정수가 아닌 고객 번호(%s)는 버린다',
    (raw) => {
      expect(readFilters(new URLSearchParams(`customer=${raw}`)).customer).toBe('');
    },
  );

  it.each(['abc', '9201.5', '-2'])('정수가 아닌 납품처 번호(%s)는 버린다', (raw) => {
    expect(readFilters(new URLSearchParams(`shipToPartner=${raw}`)).shipToPartner).toBe('');
  });

  /* 검사 상태는 'true'·'false' 두 값만 뜻이 있다. */
  it.each(['yes', '1', 'True', ''])('검사 상태의 이상한 값(%s)은 전체로 본다', (raw) => {
    expect(readFilters(new URLSearchParams(`inspection=${raw}`)).inspection).toBe('');
  });

  it('상태는 자유 문자열로 받는다', () => {
    expect(readFilters(new URLSearchParams('status=%EA%B0%80'))).toMatchObject({ status: '가' });
  });
});

describe('readPage', () => {
  it('주소의 쪽 번호를 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });

  it.each(['0', '-1', 'abc', '', '1.5'])('이상한 쪽 번호(%s)는 첫 쪽으로 본다', (raw) => {
    expect(readPage(new URLSearchParams(`page=${raw}`))).toBe(1);
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 적는다', () => {
    const params = toSearchParams(EMPTY_PERIOD, filters({ status: 'SAMPLE_STATUS_A' }), null, 1);

    expect(params.toString()).toBe('status=SAMPLE_STATUS_A');
  });

  it('조건이 하나도 없으면 주소가 비어 있다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, null, 1).toString()).toBe('');
  });

  it('기간을 채우면 두 키가 적힌다', () => {
    const params = toSearchParams({ from: '2026-08-01', to: '2026-08-31' }, EMPTY_FILTERS, null, 1);

    expect(params.get('shipDateFrom')).toBe('2026-08-01');
    expect(params.get('shipDateTo')).toBe('2026-08-31');
  });

  it('첫 쪽이면 page를 적지 않는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, null, 1).has('page')).toBe(false);
  });

  it('둘째 쪽부터는 page를 적는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, null, 2).get('page')).toBe('2');
  });

  /* 정렬이 없으면 「해제」한 상태를 나타낼 방법이 sort 키 부재뿐이다. */
  it('정렬이 없으면 sort를 적지 않는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, null, 1).has('sort')).toBe(false);
  });

  it('정렬이 있으면 sort를 적는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, 'customerId', 1).get('sort')).toBe(
      'customerId',
    );
  });

  it('정수가 아닌 번호는 주소에도 적지 않는다', () => {
    expect(
      toSearchParams(
        EMPTY_PERIOD,
        filters({ customer: 'abc', shipToPartner: '1.5' }),
        null,
        1,
      ).toString(),
    ).toBe('');
  });
});

describe('toFilterQuery', () => {
  it('채운 조건만 계약 쿼리 이름으로 옮긴다', () => {
    expect(
      toFilterQuery(
        filters({
          customer: '9101',
          shipToPartner: '9201',
          status: 'SAMPLE_STATUS_A',
          inspection: 'true',
        }),
      ),
    ).toEqual({
      customerId: 9101,
      shipToPartnerId: 9201,
      statusCode: 'SAMPLE_STATUS_A',
      shippingInspectionRequired: true,
    });
  });

  it('빈 조건은 키를 만들지 않는다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  /* `Number('abc')`는 `NaN`이고, 그대로 실으면 요청 URL에 `customerId=NaN`이 붙는다. */
  it('정수가 아닌 번호는 실리지 않는다', () => {
    expect(toFilterQuery(filters({ customer: 'abc' }))).toEqual({});
  });

  it('검사 상태 false도 명시적으로 싣는다 — 값이 있는 조건이다', () => {
    expect(toFilterQuery(filters({ inspection: 'false' }))).toEqual({
      shippingInspectionRequired: false,
    });
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나를 만든다', () => {
    const chips = toFilterChips(
      filters({ customer: '9101', shipToPartner: '9201', status: 'A', inspection: 'true' }),
      NAMES,
    );

    expect(chips.map((chip) => chip.key)).toEqual([
      'customer',
      'shipToPartner',
      'status',
      'inspection',
    ]);
  });

  it('걸리지 않은 조건은 칩을 만들지 않는다', () => {
    expect(toFilterChips(EMPTY_FILTERS, NAMES)).toEqual([]);
  });

  /* 내부 번호를 칩 문구에 내지 않는다 — 화면이 이름으로 풀어 넘긴 값만 쓴다. */
  it('고객·납품처 칩에 번호가 아니라 넘겨받은 이름이 실린다', () => {
    const chips = toFilterChips(filters({ customer: '9101', shipToPartner: '9201' }), NAMES);

    expect(chips[0]?.label).toBe(t.filters.chipCustomer('합성 고객 가'));
    expect(chips[1]?.label).toBe(t.filters.chipShipToPartner('합성 납품처 가'));
    expect(chips.map((chip) => chip.label).join(' ')).not.toContain('9101');
    expect(chips.map((chip) => chip.label).join(' ')).not.toContain('9201');
  });

  it('제거 버튼의 접근 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({ customer: '9101', shipToPartner: '9201', status: 'A', inspection: 'true' }),
      NAMES,
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
