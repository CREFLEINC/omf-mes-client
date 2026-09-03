import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  clearFilter,
  readFilters,
  readPage,
  readSelectedRequestId,
  toFilterChips,
  toRequestListQuery,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
} from './filters';
import type { InboxFilters } from './types';

const t = messages.approvalInbox;

const params = (query: string): URLSearchParams => new URLSearchParams(query);

const filledFilters: InboxFilters = {
  approvalTypeCode: 'PURCHASE_ORDER',
  statusCode: 'SAMPLE-STATUS-A',
  from: '2026-08-01',
  to: '2026-08-31',
  q: 'SYNTH-REQ',
};

describe('readFilters', () => {
  it('주소가 담은 조건을 그대로 읽는다', () => {
    expect(
      readFilters(
        params('ty=PURCHASE_ORDER&st=SAMPLE-STATUS-A&from=2026-08-01&to=2026-08-31&q=SYNTH-REQ'),
      ),
    ).toEqual(filledFilters);
  });

  it('아무것도 없으면 빈 조건이다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  it('실존하지 않는 날짜는 조건이 아니다', () => {
    /* 자릿수만 보면 통과하는 값들이다 — 그대로 실으면 서버가 400을 돌려준다. */
    expect(readFilters(params('from=2026-02-31')).from).toBe('');
    expect(readFilters(params('from=2026-13-01')).from).toBe('');
    expect(readFilters(params('to=2026-04-31')).to).toBe('');
  });

  it('자릿수가 어긋난 날짜도 조건이 아니다', () => {
    expect(readFilters(params('from=20260801')).from).toBe('');
    expect(readFilters(params('from=2026-8-1')).from).toBe('');
    expect(readFilters(params('to=오늘')).to).toBe('');
  });

  it('윤년의 2월 29일은 실존한다', () => {
    expect(readFilters(params('from=2028-02-29')).from).toBe('2028-02-29');
  });

  it('평년의 2월 29일은 실존하지 않는다', () => {
    expect(readFilters(params('from=2026-02-29')).from).toBe('');
  });

  it('빈 값은 조건이 아니다', () => {
    expect(readFilters(params('to=')).to).toBe('');
  });
});

describe('readPage', () => {
  it('양의 정수만 쪽 번호다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('정수가 아니거나 1보다 작으면 첫 쪽으로 본다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-1'))).toBe(1);
    expect(readPage(params('page=1.5'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
  });
});

describe('readSelectedRequestId', () => {
  it('양의 정수만 요청을 가리킨다', () => {
    expect(readSelectedRequestId(params('rq=9001'))).toBe(9001);
  });

  it('없거나 식별자가 아니면 고르지 않은 것이다', () => {
    expect(readSelectedRequestId(params(''))).toBeNull();
    expect(readSelectedRequestId(params('rq=xyz'))).toBeNull();
    expect(readSelectedRequestId(params('rq=0'))).toBeNull();
    expect(readSelectedRequestId(params('rq=-3'))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('조건을 전부 주소에 싣는다', () => {
    const next = toSearchParams(filledFilters, 'requested', 2);

    expect(next.get('ty')).toBe('PURCHASE_ORDER');
    expect(next.get('st')).toBe('SAMPLE-STATUS-A');
    expect(next.get('from')).toBe('2026-08-01');
    expect(next.get('to')).toBe('2026-08-31');
    expect(next.get('q')).toBe('SYNTH-REQ');
    expect(next.get('tab')).toBe('requested');
    expect(next.get('page')).toBe('2');
  });

  it('기본 탭과 첫 쪽은 주소에 적지 않는다 — 같은 화면의 주소가 두 가지가 되면 공유가 갈린다', () => {
    const next = toSearchParams(filledFilters, 'pending', 1);

    expect(next.has('tab')).toBe(false);
    expect(next.has('page')).toBe(false);
  });

  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect([...toSearchParams(EMPTY_FILTERS, 'pending', 1).keys()]).toEqual([]);
  });

  it('공백만인 검색어는 조건이 아니다', () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, q: '   ' }, 'pending', 1).has('q')).toBe(false);
  });

  it('검색어의 앞뒤 공백을 걷어 낸다', () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, q: '  SYNTH-REQ ' }, 'pending', 1).get('q')).toBe(
      'SYNTH-REQ',
    );
  });

  it('실존하지 않는 날짜는 주소에도 싣지 않는다', () => {
    const next = toSearchParams({ ...EMPTY_FILTERS, from: '2026-02-31' }, 'pending', 1);

    expect(next.has('from')).toBe(false);
  });

  it('고른 요청을 만들지 않는다 — 조건·탭·쪽이 바뀌면 선택이 저절로 풀린다', () => {
    const next = toSearchParams(filledFilters, 'requested', 3);

    expect(next.has('rq')).toBe(false);
  });
});

describe('toSelectionSearchParams', () => {
  it('조건과 쪽은 그대로 두고 고른 요청만 얹는다', () => {
    const next = toSelectionSearchParams(filledFilters, 'requested', 2, 9001);

    expect(next.get('rq')).toBe('9001');
    expect(next.get('page')).toBe('2');
    expect(next.get('tab')).toBe('requested');
    expect(next.get('ty')).toBe('PURCHASE_ORDER');
  });

  it('고른 것이 없으면 그 자리를 만들지 않는다', () => {
    expect(toSelectionSearchParams(filledFilters, 'pending', 1, null).has('rq')).toBe(false);
  });
});

describe('withoutSelection', () => {
  it('고른 요청만 뺀다 — 조건·탭·쪽은 그대로다', () => {
    const next = withoutSelection(
      new URLSearchParams('tab=requested&ty=PURCHASE_ORDER&page=2&rq=9001'),
    );

    expect(next.has('rq')).toBe(false);
    expect(next.get('tab')).toBe('requested');
    expect(next.get('ty')).toBe('PURCHASE_ORDER');
    expect(next.get('page')).toBe('2');
  });

  it('화면이 모르는 값도 남긴다 — 주소를 다시 조립하지 않는다', () => {
    const next = withoutSelection(new URLSearchParams('rq=9001&unknown=synthetic'));

    expect(next.get('unknown')).toBe('synthetic');
    expect(next.has('rq')).toBe(false);
  });

  it('고른 것이 없어도 나머지를 건드리지 않는다', () => {
    expect(withoutSelection(new URLSearchParams('q=SYNTH')).toString()).toBe('q=SYNTH');
  });

  it('넘겨받은 것을 고치지 않는다 — 부르는 자리의 값이 뒤에서 바뀌면 안 된다', () => {
    const source = new URLSearchParams('rq=9001&q=SYNTH');

    withoutSelection(source);

    expect(source.get('rq')).toBe('9001');
  });
});

describe('toRequestListQuery', () => {
  it('탭의 축과 조건을 함께 싣는다', () => {
    expect(toRequestListQuery(filledFilters, 'pending', 2)).toEqual({
      assignedToMe: true,
      pendingOnly: true,
      approvalTypeCode: 'PURCHASE_ORDER',
      statusCode: 'SAMPLE-STATUS-A',
      requestedAtFrom: '2026-08-01',
      requestedAtTo: '2026-08-31',
      q: 'SYNTH-REQ',
      page: 2,
    });
  });

  it('탭을 옮기면 축이 바뀐다', () => {
    const query = toRequestListQuery(EMPTY_FILTERS, 'requested', 1);

    expect(query).toEqual({ requestedByMe: true });
    expect(query.assignedToMe).toBeUndefined();
    expect(query.pendingOnly).toBeUndefined();
  });

  it('첫 쪽은 싣지 않는다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, 'pending', 1).page).toBeUndefined();
  });

  it('크기를 싣지 않는다 — 서버 기본값을 쓴다', () => {
    expect(Object.keys(toRequestListQuery(filledFilters, 'pending', 1))).not.toContain('size');
  });

  it('상신일을 RFC3339로 바꾸지 않는다 — 계약이 날짜만 받는다', () => {
    const query = toRequestListQuery(filledFilters, 'pending', 1);

    expect(query.requestedAtFrom).toBe('2026-08-01');
    expect(query.requestedAtFrom).not.toContain('T');
    expect(query.requestedAtTo).not.toContain('T');
  });

  it('실존하지 않는 날짜는 요청에 실리지 않는다', () => {
    const query = toRequestListQuery({ ...EMPTY_FILTERS, from: '2026-02-31' }, 'pending', 1);

    expect(query.requestedAtFrom).toBeUndefined();
  });

  it('공백만인 검색어는 요청에 실리지 않는다', () => {
    expect(toRequestListQuery({ ...EMPTY_FILTERS, q: '  ' }, 'pending', 1).q).toBeUndefined();
  });

  it('구간의 한쪽만 있어도 그쪽만 싣는다', () => {
    const query = toRequestListQuery({ ...EMPTY_FILTERS, from: '2026-08-01' }, 'pending', 1);

    expect(query.requestedAtFrom).toBe('2026-08-01');
    expect(query.requestedAtTo).toBeUndefined();
  });
});

describe('toFilterChips', () => {
  it('걸어 둔 조건마다 칩 하나', () => {
    expect(toFilterChips(filledFilters).map((chip) => chip.key)).toEqual([
      'approvalTypeCode',
      'statusCode',
      'period',
      'q',
    ]);
  });

  it('빈 조건에는 칩이 없다', () => {
    expect(toFilterChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('기간은 한 칩이고 한쪽만 있으면 그 사실을 적는다', () => {
    expect(
      toFilterChips({ ...EMPTY_FILTERS, from: '2026-08-01', to: '2026-08-31' })[0]?.label,
    ).toBe(t.filters.chipPeriod('2026-08-01', '2026-08-31'));
    expect(toFilterChips({ ...EMPTY_FILTERS, from: '2026-08-01' })[0]?.label).toBe(
      t.filters.chipPeriodFrom('2026-08-01'),
    );
    expect(toFilterChips({ ...EMPTY_FILTERS, to: '2026-08-31' })[0]?.label).toBe(
      t.filters.chipPeriodTo('2026-08-31'),
    );
  });

  it('제거 버튼의 이름이 서로 다르다 — 「제거」가 둘이면 무엇을 푸는지 알 수 없다', () => {
    const labels = toFilterChips(filledFilters).map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('검색어 칩은 앞뒤 공백을 걷어 낸 값을 보인다', () => {
    expect(toFilterChips({ ...EMPTY_FILTERS, q: ' SYNTH-REQ ' })[0]?.label).toBe(
      t.filters.chipKeyword('SYNTH-REQ'),
    );
  });
});

describe('clearFilter', () => {
  it('조건 하나만 푼다', () => {
    expect(clearFilter(filledFilters, 'approvalTypeCode')).toEqual({
      ...filledFilters,
      approvalTypeCode: '',
    });
  });

  it('기간은 두 끝을 함께 푼다 — 한쪽만 남으면 칩이 말하지 않은 조건이 남는다', () => {
    expect(clearFilter(filledFilters, 'period')).toEqual({ ...filledFilters, from: '', to: '' });
  });
});
