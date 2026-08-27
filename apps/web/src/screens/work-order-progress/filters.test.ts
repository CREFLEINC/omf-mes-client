import { describe, expect, it } from 'vitest';

import {
  PAGE_SIZE,
  type ProgressFilters,
  readFilters,
  readPage,
  readSelectedWorkOrderId,
  toAppliedSearchParams,
  toProgressListQuery,
  withPage,
  withSelectedWorkOrder,
  withSort,
} from './filters';
import { DEFAULT_SORT, type SortState } from './sort';

const TODAY = new Date(2026, 7, 30);
const KST = 540;
const NARROW = { from: '2026-08-01', to: '2026-08-30' };

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<ProgressFilters> = {}): ProgressFilters => ({
  ...NARROW,
  productionLineId: '',
  statusCode: '',
  productionOrderId: '',
  keyword: '',
  ...overrides,
});

const queryOf = (
  overrides: Partial<ProgressFilters> = {},
  sort: SortState = DEFAULT_SORT,
  page = 1,
) => toProgressListQuery(filters(overrides), sort, page, KST);

describe('readFilters', () => {
  it('주소에서 조건을 읽는다', () => {
    const read = readFilters(
      params('from=2026-08-01&to=2026-08-30&line=7&st=SYN_RUN&po=31&q=WO-1'),
      TODAY,
    );

    expect(read).toEqual({
      from: '2026-08-01',
      to: '2026-08-30',
      productionLineId: '7',
      statusCode: 'SYN_RUN',
      productionOrderId: '31',
      keyword: 'WO-1',
    });
  });

  /* ⛔ L-3 — 「조건 없는 조회」라는 상태를 만들지 않는다. 비면 최근 한 달로 되돌린다. */
  it.each([
    ['빈 주소', ''],
    ['기간 절반만', 'from=2026-08-01'],
    ['달력에 없는 날', 'from=2026-02-31&to=2026-03-05'],
    ['역순', 'from=2026-08-30&to=2026-08-01'],
  ])('⛔ %s 이면 최근 한 달로 되돌린다', (_name, search) => {
    const read = readFilters(params(search), TODAY);

    expect({ from: read.from, to: read.to }).toEqual(NARROW);
  });

  it.each([
    ['0', 'line=0'],
    ['음수', 'line=-1'],
    ['숫자가 아님', 'line=abc'],
  ])('⛔ 부를 수 없는 라인 식별자(%s)는 안 고른 것으로 둔다', (_name, search) => {
    expect(readFilters(params(search), TODAY).productionLineId).toBe('');
  });
});

describe('toProgressListQuery', () => {
  it('⛔ 기간이 막히면 요청을 만들지 않는다', () => {
    expect(toProgressListQuery(filters({ from: '', to: '' }), DEFAULT_SORT, 1, KST)).toBeNull();
  });

  it('기간을 반열림으로 싣는다', () => {
    expect(queryOf()).toMatchObject({
      plannedStartFrom: '2026-08-01T00:00:00+09:00',
      plannedStartTo: '2026-08-31T00:00:00+09:00',
    });
  });

  it('실적 누계를 함께 받는다 — 목록의 양품·달성률이 여기서 온다', () => {
    expect(queryOf()?.withProgress).toBe(true);
  });

  it(`한 쪽에 ${String(PAGE_SIZE)}건을 받는다`, () => {
    expect(queryOf()?.size).toBe(PAGE_SIZE);
  });

  it('정렬을 요청에 싣는다 — 규칙 자체는 sort 모듈이 갖는다', () => {
    expect(queryOf({}, { key: 'workOrderNo', direction: 'desc' })?.sort).toBe('workOrderNo,desc');
  });

  it('고른 조건만 싣는다 — 비운 칸은 키 자체를 보내지 않는다', () => {
    const query = queryOf();

    for (const key of ['productionLineId', 'statusCode', 'productionOrderId', 'q']) {
      expect(query).not.toHaveProperty(key);
    }
  });

  it('채운 조건은 싣는다', () => {
    expect(
      queryOf({
        productionLineId: '7',
        statusCode: 'SYN_RUN',
        productionOrderId: '31',
        keyword: 'WO-1',
      }),
    ).toMatchObject({
      productionLineId: 7,
      statusCode: 'SYN_RUN',
      productionOrderId: 31,
      q: 'WO-1',
    });
  });

  it('첫 쪽은 쪽 번호를 싣지 않는다', () => {
    expect(queryOf()).not.toHaveProperty('page');
    expect(queryOf({}, DEFAULT_SORT, 2)?.page).toBe(2);
  });

  /* ⛔ 계약에 공정 파라미터가 없다. 자리만 만들어 두면 「고장 났나」로 읽힌다. */
  it('⛔ 공정으로 거르는 조건을 만들지 않는다', () => {
    const query = queryOf();

    for (const key of ['processId', 'routingOperationId', 'operationId']) {
      expect(query).not.toHaveProperty(key);
    }
  });
});

describe('주소 갱신', () => {
  it('조건을 주소에 싣고 비운 것은 지운다', () => {
    const next = toAppliedSearchParams(params('line=7&st=OLD'), filters({ keyword: 'WO-1' }), 1);

    expect(next.get('q')).toBe('WO-1');
    expect(next.has('line')).toBe(false);
    expect(next.has('st')).toBe(false);
  });

  /* 조건이 바뀌면 앞서 고른 W/O가 목록에 없을 수 있다. */
  it('⛔ 조건을 바꾸면 고른 W/O를 지운다', () => {
    expect(toAppliedSearchParams(params('workOrderId=7001'), filters(), 1).has('workOrderId')).toBe(
      false,
    );
  });

  /* 순서가 바뀌면 2쪽의 내용이 통째로 달라진다 — 그 자리에 머물면 엉뚱한 줄을 본다. */
  it('⛔ 순서를 바꾸면 첫 쪽으로 되돌린다', () => {
    const next = withSort(params('page=3'), { key: 'workOrderNo', direction: 'asc' });

    expect(next.get('sort')).toBe('workOrderNo,asc');
    expect(next.has('page')).toBe(false);
  });

  it('쪽 이동은 첫 쪽에서 키를 지운다 — 주소를 깨끗이 둔다', () => {
    expect(withPage(params('page=3'), 1).has('page')).toBe(false);
    expect(withPage(params(''), 2).get('page')).toBe('2');
  });

  it('고른 W/O를 주소에 담고 지울 수 있다', () => {
    expect(withSelectedWorkOrder(params(''), 7001).get('workOrderId')).toBe('7001');
    expect(withSelectedWorkOrder(params('workOrderId=7001'), null).has('workOrderId')).toBe(false);
  });
});

describe('readPage · readSelectedWorkOrderId', () => {
  it.each([
    ['없음', '', 1],
    ['1쪽', 'page=1', 1],
    ['3쪽', 'page=3', 3],
    ['0쪽', 'page=0', 1],
    ['숫자 아님', 'page=abc', 1],
  ])('쪽 번호(%s)를 읽는다', (_name, search, expected) => {
    expect(readPage(params(search))).toBe(expected);
  });

  it.each([
    ['없음', '', null],
    ['식별자', 'workOrderId=7001', 7001],
    ['0', 'workOrderId=0', null],
    ['숫자 아님', 'workOrderId=abc', null],
  ])('고른 W/O(%s)를 읽는다', (_name, search, expected) => {
    expect(readSelectedWorkOrderId(params(search))).toBe(expected);
  });
});
