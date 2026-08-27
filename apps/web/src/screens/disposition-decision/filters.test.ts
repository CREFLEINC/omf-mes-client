import { describe, expect, it } from 'vitest';

import {
  readPage,
  readPendingFilters,
  readSelectedNonconformanceId,
  readTab,
  toAppliedSearchParams,
  toPendingListQuery,
  withSelectedNonconformance,
  withTab,
  type PendingFilters,
} from './filters';

const TODAY = new Date(2026, 7, 12);
const KST = 540;
/** ⚠ 지어낸 자리표시다 — 심각도·상태의 실제 값 목록은 아직 확정되지 않았다. */
const SEVERITY_CODES = ['CODE-B'];
const STATUS_CODES = ['CODE-C'];

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<PendingFilters> = {}): PendingFilters => ({
  from: '2026-07-14',
  to: '2026-08-12',
  itemId: '',
  severityCode: '',
  statusCode: '',
  ...overrides,
});

describe('readPendingFilters', () => {
  it('주소에 기간이 없으면 최근 한 달로 되돌린다 — 조건 없는 조회를 만들지 않는다', () => {
    expect(readPendingFilters(params(''), TODAY)).toEqual(filters());
  });

  it('주소의 기간을 그대로 쓴다', () => {
    const read = readPendingFilters(params('from=2026-08-01&to=2026-08-05'), TODAY);

    expect(read.from).toBe('2026-08-01');
    expect(read.to).toBe('2026-08-05');
  });

  it('시작이 끝보다 뒤면 기본 기간으로 되돌린다', () => {
    const read = readPendingFilters(params('from=2026-08-05&to=2026-08-01'), TODAY);

    expect(read).toEqual(filters());
  });

  it('달력에 없는 날은 기본 기간으로 되돌린다', () => {
    expect(readPendingFilters(params('from=2026-02-31&to=2026-08-12'), TODAY)).toEqual(filters());
  });

  it('한쪽만 있는 기간도 기본 기간으로 되돌린다', () => {
    expect(readPendingFilters(params('from=2026-08-01'), TODAY)).toEqual(filters());
  });

  it('품목은 양의 정수일 때만 읽는다', () => {
    expect(readPendingFilters(params('item=5001'), TODAY).itemId).toBe('5001');
    expect(readPendingFilters(params('item=0'), TODAY).itemId).toBe('');
    expect(readPendingFilters(params('item=-3'), TODAY).itemId).toBe('');
    expect(readPendingFilters(params('item=abc'), TODAY).itemId).toBe('');
  });

  it('코드는 아는 값일 때만 읽는다 — 모르는 값을 그대로 보내지 않는다', () => {
    const known = readPendingFilters(params('sev=CODE-B&st=CODE-C'), TODAY, SEVERITY_CODES, [
      'CODE-C',
    ]);

    expect(known.severityCode).toBe('CODE-B');
    expect(known.statusCode).toBe('CODE-C');
    expect(readPendingFilters(params('sev=CODE-Z'), TODAY, SEVERITY_CODES).severityCode).toBe('');
  });

  it('값 목록이 비어 있으면 어떤 코드도 읽지 않는다', () => {
    expect(readPendingFilters(params('sev=CODE-B'), TODAY).severityCode).toBe('');
  });
});

describe('readPage', () => {
  it('없거나 쓸 수 없는 값이면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=x'))).toBe(1);
  });

  it('양의 정수를 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });
});

describe('readTab', () => {
  it('기본은 판정 대기다', () => {
    expect(readTab(params(''))).toBe('pending');
    expect(readTab(params('tab=엉뚱한값'))).toBe('pending');
  });

  it('처리 이력 탭을 읽는다', () => {
    expect(readTab(params('tab=history'))).toBe('history');
  });
});

describe('readSelectedNonconformanceId', () => {
  it('W-03-09가 넘긴 진입 키를 읽는다', () => {
    expect(readSelectedNonconformanceId(params('nonconformanceId=1001'))).toBe(1001);
  });

  it('식별자가 아니면 고른 것이 없다', () => {
    expect(readSelectedNonconformanceId(params('nonconformanceId=0'))).toBeNull();
    expect(readSelectedNonconformanceId(params('nonconformanceId=abc'))).toBeNull();
    expect(readSelectedNonconformanceId(params(''))).toBeNull();
  });
});

describe('toAppliedSearchParams', () => {
  it('조건을 주소에 싣고 첫 쪽은 생략한다', () => {
    const next = toAppliedSearchParams(params(''), filters({ itemId: '5001' }), 1);

    expect(next.get('from')).toBe('2026-07-14');
    expect(next.get('to')).toBe('2026-08-12');
    expect(next.get('item')).toBe('5001');
    expect(next.get('page')).toBeNull();
  });

  it('둘째 쪽부터 쪽 번호를 싣는다', () => {
    expect(toAppliedSearchParams(params(''), filters(), 2).get('page')).toBe('2');
  });

  it('조건이 바뀌면 앞서 고른 부적합을 지운다', () => {
    const next = toAppliedSearchParams(params('nonconformanceId=1001'), filters(), 1);

    expect(next.get('nonconformanceId')).toBeNull();
  });

  it('빈 조건은 주소에서 지운다 — 빈 값을 남기지 않는다', () => {
    const next = toAppliedSearchParams(params('item=5001&sev=CODE-B'), filters(), 1);

    expect(next.get('item')).toBeNull();
    expect(next.get('sev')).toBeNull();
  });

  it('이 화면이 모르는 주소 값은 건드리지 않는다', () => {
    expect(toAppliedSearchParams(params('keep=1'), filters(), 1).get('keep')).toBe('1');
  });
});

describe('withSelectedNonconformance', () => {
  it('고른 부적합을 싣고 지운다', () => {
    expect(withSelectedNonconformance(params(''), 1001).get('nonconformanceId')).toBe('1001');
    expect(
      withSelectedNonconformance(params('nonconformanceId=1001'), null).get('nonconformanceId'),
    ).toBeNull();
  });
});

describe('withTab', () => {
  it('처리 이력으로 옮기면 쪽과 고른 부적합을 지운다', () => {
    const next = withTab(params('page=3&nonconformanceId=1001'), 'history');

    expect(next.get('tab')).toBe('history');
    expect(next.get('page')).toBeNull();
    expect(next.get('nonconformanceId')).toBeNull();
  });

  it('판정 대기는 기본값이라 주소에 남기지 않는다', () => {
    expect(withTab(params('tab=history'), 'pending').get('tab')).toBeNull();
  });
});

const queryOf = (
  value: ReturnType<typeof toPendingListQuery>,
): NonNullable<ReturnType<typeof toPendingListQuery>> => {
  if (value === null) throw new Error('기간이 막혀 조회 조건을 만들지 못했다');
  return value;
};

describe('toPendingListQuery', () => {
  it('기간을 언제나 싣는다 — 반열림으로 보낸다', () => {
    expect(toPendingListQuery(filters(), 1, KST)).toEqual({
      openedFrom: '2026-07-14T00:00:00+09:00',
      openedTo: '2026-08-13T00:00:00+09:00',
    });
  });

  it('고른 조건만 싣는다 — 빈 코드를 보내지 않는다', () => {
    const query = queryOf(
      toPendingListQuery(
        filters({ itemId: '5001', severityCode: 'CODE-B', statusCode: 'CODE-C' }),
        2,
        KST,
      ),
    );

    expect(query.itemId).toBe(5001);
    expect(query.severityCode).toBe('CODE-B');
    expect(query.statusCode).toBe('CODE-C');
    expect(query.page).toBe(2);
  });

  it('품목을 숫자로 보낸다 — 계약이 정수를 받는다', () => {
    expect(typeof queryOf(toPendingListQuery(filters({ itemId: '5001' }), 1, KST)).itemId).toBe(
      'number',
    );
  });

  it('첫 쪽이면 쪽 번호를 싣지 않는다', () => {
    expect(queryOf(toPendingListQuery(filters(), 1, KST)).page).toBeUndefined();
  });

  it('⛔ 기간이 막히면 조회 조건을 만들지 않는다 — 막았는데 요청이 나가지 않게 한다', () => {
    expect(toPendingListQuery(filters({ from: '', to: '' }), 1, KST)).toBeNull();
    expect(toPendingListQuery(filters({ from: '2026-02-31' }), 1, KST)).toBeNull();
    expect(
      toPendingListQuery(filters({ from: '2026-08-13', to: '2026-08-12' }), 1, KST),
    ).toBeNull();
  });
});
