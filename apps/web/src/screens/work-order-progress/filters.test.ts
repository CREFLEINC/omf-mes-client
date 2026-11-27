import { describe, expect, it } from 'vitest';

import {
  PAGE_SIZE,
  type ProgressFilters,
  readFilters,
  readPage,
  readSelectedWorkOrderId,
  toAppliedSearchParams,
  readView,
  toProgressListQuery,
  toStatusCountQuery,
  withPage,
  withPeriod,
  withSelectedWorkOrder,
  withSort,
  withView,
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
  processId: '',
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
      params('from=2026-08-01&to=2026-08-30&line=7&st=SYN_RUN&po=31&proc=41&q=WO-1'),
      TODAY,
    );

    expect(read).toEqual({
      from: '2026-08-01',
      to: '2026-08-30',
      productionLineId: '7',
      statusCode: 'SYN_RUN',
      productionOrderId: '31',
      processId: '41',
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

  /* 요약은 조건 전체 기준이고 목록과 같은 트랜잭션에서 온다 — 화면이 이 쪽의 줄을 더해 만들지 않는다. */
  it('요약 집계를 함께 받는다 — 요약 줄과 상태 칩의 건수가 여기서 온다', () => {
    expect(queryOf()?.withSummary).toBe(true);
  });

  it(`한 쪽에 ${String(PAGE_SIZE)}건을 받는다`, () => {
    expect(queryOf()?.size).toBe(PAGE_SIZE);
  });

  it('정렬을 요청에 싣는다 — 규칙 자체는 sort 모듈이 갖는다', () => {
    expect(queryOf({}, { key: 'workOrderNo', direction: 'desc' })?.sort).toBe('workOrderNo,desc');
  });

  it('고른 조건만 싣는다 — 비운 칸은 키 자체를 보내지 않는다', () => {
    const query = queryOf();

    for (const key of ['productionLineId', 'statusCode', 'productionOrderId', 'processId', 'q']) {
      expect(query).not.toHaveProperty(key);
    }
  });

  it('채운 조건은 싣는다', () => {
    expect(
      queryOf({
        productionLineId: '7',
        statusCode: 'SYN_RUN',
        productionOrderId: '31',
        processId: '41',
        keyword: 'WO-1',
      }),
    ).toMatchObject({
      productionLineId: 7,
      statusCode: 'SYN_RUN',
      productionOrderId: 31,
      processId: 41,
      q: 'WO-1',
    });
  });

  it('첫 쪽은 쪽 번호를 싣지 않는다', () => {
    expect(queryOf()).not.toHaveProperty('page');
    expect(queryOf({}, DEFAULT_SORT, 2)?.page).toBe(2);
  });

  /* ⛔ 공정은 계약의 `processId` 하나로만 건다 — Routing 공정 번호로 화면이 거르지 않는다(쪽 단위라 틀린다). */
  it('⛔ 공정 조건은 processId 로만 싣는다', () => {
    const query = queryOf({ processId: '41' });

    for (const key of ['routingOperationId', 'operationId']) {
      expect(query).not.toHaveProperty(key);
    }
  });
});

describe('toStatusCountQuery', () => {
  /* 고르지 않았으면 목록의 요약이 이미 상태 전체를 센 것이다 — 같은 것을 두 번 묻지 않는다. */
  it('상태를 고르지 않았으면 묻지 않는다', () => {
    expect(toStatusCountQuery(filters(), KST)).toBeNull();
  });

  it('⛔ 상태만 빼고 나머지 조건은 그대로 싣는다 — 다른 상태 칩의 건수가 남는다', () => {
    const query = toStatusCountQuery(
      filters({ statusCode: 'SYN_RUN', productionLineId: '7', processId: '41', keyword: 'WO-1' }),
      KST,
    );

    expect(query).toEqual({
      plannedStartFrom: '2026-08-01T00:00:00+09:00',
      plannedStartTo: '2026-08-31T00:00:00+09:00',
      productionLineId: 7,
      processId: 41,
      q: 'WO-1',
      size: 1,
      withSummary: true,
    });
  });

  it('⛔ 기간이 막히면 묻지 않는다', () => {
    expect(toStatusCountQuery(filters({ statusCode: 'SYN_RUN', from: '' }), KST)).toBeNull();
  });
});

describe('보기', () => {
  it('주소에 적히지 않았거나 모르는 값이면 표다', () => {
    expect(readView(params(''))).toBe('table');
    expect(readView(params('view=cards'))).toBe('table');
    expect(readView(params('view=timeline'))).toBe('timeline');
  });

  it('일정으로 바꾸면 주소에 적고, 표는 기본이라 지운다', () => {
    expect(withView(params('q=WO-1'), 'timeline').toString()).toBe('q=WO-1&view=timeline');
    expect(withView(params('q=WO-1&view=timeline'), 'table').toString()).toBe('q=WO-1');
  });

  /* 일정 보기는 계획 시작 순으로 다시 받는다 — 2쪽의 내용이 달라진다. 고른 W/O 는 그대로다. */
  it('⛔ 보기를 바꾸면 첫 쪽으로 되돌리되 고른 W/O 는 놓지 않는다', () => {
    const next = withView(params('page=3&workOrderId=7001&sort=workOrderNo,desc'), 'timeline');

    expect(next.has('page')).toBe(false);
    expect(next.get('workOrderId')).toBe('7001');
    expect(next.get('sort')).toBe('workOrderNo,desc');
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

/*
 * 주소에 기간이 없이 들어온 첫 화면에서 쓴다. ⛔ **조회를 다시 거는 것이 아니다** —
 * `?workOrderId=…` 만 담긴 링크를 받아 들어온 사용자에게서 선택을 빼앗지 않으려는 것이다.
 */
describe('withPeriod', () => {
  it('기간을 적는다', () => {
    const next = withPeriod(params(''), NARROW);

    expect(next.get('from')).toBe('2026-08-01');
    expect(next.get('to')).toBe('2026-08-30');
  });

  it('⛔ 고른 W/O 를 지우지 않는다 — 조회를 다시 거는 것이 아니다', () => {
    const next = withPeriod(params('workOrderId=7001'), NARROW);

    expect(next.get('workOrderId')).toBe('7001');
  });

  it('⛔ 쪽도 정렬도 건드리지 않는다', () => {
    const next = withPeriod(params('page=3&sort=workOrderNo,desc'), NARROW);

    expect(next.get('page')).toBe('3');
    expect(next.get('sort')).toBe('workOrderNo,desc');
  });

  it('다른 조건도 그대로 둔다', () => {
    const next = withPeriod(params('q=SYN-WO&line=7'), NARROW);

    expect(next.get('q')).toBe('SYN-WO');
    expect(next.get('line')).toBe('7');
  });

  /* 달력에 없는 값이 주소에 남으면 그 주소로 들어온 다음 사람이 막힌 화면을 본다. */
  it('쓸 수 없는 날짜는 적지 않는다', () => {
    const next = withPeriod(params(''), { from: '2026-13-01', to: '' });

    expect(next.has('from')).toBe(false);
    expect(next.has('to')).toBe(false);
  });
});
