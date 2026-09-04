import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  PENDING_ONLY_DEFAULT,
  clearFilter,
  readFilters,
  readPage,
  readPendingOnly,
  readSelectedRequestId,
  toFilterChips,
  toRequestListQuery,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
} from './filters';
import type { RequestFilters } from './types';

const t = messages.iqcSkipApproval;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filtersOf = (partial: Partial<RequestFilters> = {}): RequestFilters => ({
  ...EMPTY_FILTERS,
  ...partial,
});

describe('readFilters', () => {
  it('주소가 담은 조건을 그대로 읽는다', () => {
    expect(
      readFilters(params('st=SAMPLE-STATUS-OPEN&from=2026-08-01&to=2026-08-31&q=SYNTH')),
    ).toEqual({
      statusCode: 'SAMPLE-STATUS-OPEN',
      from: '2026-08-01',
      to: '2026-08-31',
      q: 'SYNTH',
    });
  });

  it('아무것도 없으면 빈 조건이다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  /**
   * **실존 판정을 읽는 자리에서 한다.** 자릿수만 보면 `2026-02-31`이 통과해 그대로 요청에
   * 실리는데, 계약의 목록 응답에는 400이 없어 서버가 그런 값에 무엇을 하는지 정해져 있지도 않다.
   */
  it('실존하지 않는 날짜는 조건이 아니다', () => {
    expect(readFilters(params('from=2026-02-31&to=2026-13-01')).from).toBe('');
    expect(readFilters(params('from=2026-02-31&to=2026-13-01')).to).toBe('');
  });

  it('있는 날짜는 윤년의 2월 29일도 남긴다 — 되짚기 판정이라 자릿수 규칙이 아니다', () => {
    expect(readFilters(params('from=2028-02-29')).from).toBe('2028-02-29');
    expect(readFilters(params('from=2026-02-29')).from).toBe('');
  });

  it('날짜 꼴이 아니면 조건이 아니다', () => {
    expect(readFilters(params('from=어제&to=2026-8-1')).from).toBe('');
    expect(readFilters(params('from=어제&to=2026-8-1')).to).toBe('');
  });
});

/**
 * **주소 키마다 위생 판정을 지난다 — 상태 코드도 예외가 아니다.**
 *
 * 날짜는 실존 되짚기, 쪽·`rq`는 식별자, `pd`는 「모르는 값 = 기본값」, 검색어는 `trim`을 지나는데
 * 상태 코드만 원문 비교였다. `?st=%20%20`으로 들어오면 **어떤 요청도 걸리지 않는 조건**이
 * 요청에 실리고 주소에 다시 적히며 **라벨이 빈 칩**이 선다 — 사용자에게는 「내 결재 대기
 * 0건」으로 읽힌다. 판정 화면에서 그 오독은 화면을 떠나는 신호다.
 *
 * **읽는 자리 하나가 막는다.** 주소·요청·칩 셋은 그 결과를 받으므로 여기서 걸러지면 함께 낫는다.
 */
describe('상태 코드 위생 — 주소는 손으로 고쳐지는 자리다', () => {
  const blank = readFilters(params('st=%20%20'));

  it('공백만인 상태 코드는 조건이 아니다', () => {
    expect(blank.statusCode).toBe('');
  });

  it('요청에 실리지 않는다', () => {
    expect(toRequestListQuery(blank, true, 1, null).statusCode).toBeUndefined();
  });

  it('주소에 다시 적히지 않는다', () => {
    expect(toSearchParams(blank, true, 1).get('st')).toBeNull();
  });

  it('칩이 되지 않는다 — 라벨이 빈 칩은 무엇을 푸는 것인지 말하지 못한다', () => {
    expect(toFilterChips(blank)).toEqual([]);
  });

  /** 짝 양성 — 값이 있는 코드는 그대로 지나야 「걸러진다」가 뜻을 갖는다. */
  it('값이 있는 상태 코드는 앞뒤 공백만 걷고 그대로 지난다', () => {
    const kept = readFilters(params('st=%20SAMPLE-STATUS-OPEN%20'));

    expect(kept.statusCode).toBe('SAMPLE-STATUS-OPEN');
    expect(toRequestListQuery(kept, true, 1, null).statusCode).toBe('SAMPLE-STATUS-OPEN');
    expect(toSearchParams(kept, true, 1).get('st')).toBe('SAMPLE-STATUS-OPEN');
    expect(toFilterChips(kept)[0]?.key).toBe('statusCode');
  });
});

describe('readPendingOnly — 기본이 켜짐이다', () => {
  it('주소에 아무것도 없으면 켜져 있다', () => {
    expect(readPendingOnly(params(''))).toBe(true);
    expect(PENDING_ONLY_DEFAULT).toBe(true);
  });

  it('`pd=0`이면 꺼진다 — 끈 것만 주소에 적힌다', () => {
    expect(readPendingOnly(params('pd=0'))).toBe(false);
  });

  it('모르는 값은 기본값으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPendingOnly(params('pd=엉뚱한값'))).toBe(true);
    expect(readPendingOnly(params('pd='))).toBe(true);
    expect(readPendingOnly(params('pd=1'))).toBe(true);
  });
});

describe('readPage · readSelectedRequestId', () => {
  it('쪽은 1부터다. 정수가 아니면 첫 쪽으로 본다', () => {
    expect(readPage(params('page=3'))).toBe(3);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-1'))).toBe(1);
    expect(readPage(params('page=1.5'))).toBe(1);
    expect(readPage(params('page=xyz'))).toBe(1);
    expect(readPage(params(''))).toBe(1);
  });

  it('고른 요청은 식별자일 때만 선다', () => {
    expect(readSelectedRequestId(params('rq=9001'))).toBe(9001);
    expect(readSelectedRequestId(params('rq=xyz'))).toBeNull();
    expect(readSelectedRequestId(params('rq=0'))).toBeNull();
    expect(readSelectedRequestId(params('rq=-3'))).toBeNull();
    expect(readSelectedRequestId(params(''))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('걸린 조건만 적는다 — 빈 조건은 키 자체를 두지 않는다', () => {
    const next = toSearchParams(filtersOf({ q: 'SYNTH' }), true, 1);

    expect(next.toString()).toBe('q=SYNTH');
  });

  it('기본값은 적지 않는다 — 켜진 확인칸과 첫 쪽', () => {
    expect(toSearchParams(EMPTY_FILTERS, true, 1).toString()).toBe('');
  });

  it('확인칸을 끄면 그때만 적는다', () => {
    expect(toSearchParams(EMPTY_FILTERS, false, 1).get('pd')).toBe('0');
  });

  it('둘째 쪽부터 적는다', () => {
    expect(toSearchParams(EMPTY_FILTERS, true, 2).get('page')).toBe('2');
    expect(toSearchParams(EMPTY_FILTERS, true, 1).get('page')).toBeNull();
  });

  it('공백만인 검색어는 조건이 아니다', () => {
    expect(toSearchParams(filtersOf({ q: '   ' }), true, 1).get('q')).toBeNull();
  });

  it('앞뒤 공백을 걷어 낸 검색어를 적는다', () => {
    expect(toSearchParams(filtersOf({ q: '  SYNTH  ' }), true, 1).get('q')).toBe('SYNTH');
  });

  it('실존하지 않는 날짜는 적지 않는다', () => {
    const next = toSearchParams(filtersOf({ from: '2026-02-31', to: '2026-08-31' }), true, 1);

    expect(next.get('from')).toBeNull();
    expect(next.get('to')).toBe('2026-08-31');
  });

  /** 수명 표 1~4행이 이 한 줄로 지켜진다 — 조건·쪽·확인칸이 바뀌면 선택이 함께 풀린다. */
  it('고른 요청을 만들지 않는다', () => {
    expect(toSearchParams(filtersOf({ q: 'SYNTH' }), false, 3).get('rq')).toBeNull();
  });
});

describe('toSelectionSearchParams', () => {
  it('조건·확인칸·쪽을 그대로 두고 선택만 얹는다', () => {
    const next = toSelectionSearchParams(filtersOf({ q: 'SYNTH' }), false, 2, 9001);

    expect(next.get('q')).toBe('SYNTH');
    expect(next.get('pd')).toBe('0');
    expect(next.get('page')).toBe('2');
    expect(next.get('rq')).toBe('9001');
  });

  it('해제하면 선택 자리를 두지 않는다', () => {
    expect(toSelectionSearchParams(EMPTY_FILTERS, true, 1, null).toString()).toBe('');
  });
});

describe('withoutSelection', () => {
  it('고른 요청만 뺀다 — 화면이 모르는 값도 그대로 둔다', () => {
    const next = withoutSelection(params('q=SYNTH&rq=9001&mystery=1'));

    expect(next.get('rq')).toBeNull();
    expect(next.get('q')).toBe('SYNTH');
    expect(next.get('mystery')).toBe('1');
  });
});

describe('toRequestListQuery — 고정 축과 조건', () => {
  it('내가 승인자인 것만 부른다 — 이 축은 조건이 아니라 화면의 전제다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1, null).assignedToMe).toBe(true);
  });

  it('확인칸이 켜지면 대기만 싣고, 끄면 그 조건만 빠진다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1, null).pendingOnly).toBe(true);

    const off = toRequestListQuery(EMPTY_FILTERS, false, 1, null);

    expect(off.pendingOnly).toBeUndefined();
    expect(off.assignedToMe).toBe(true);
  });

  /** **전환 감지기**(M06의 단위 몫) — 자리표시를 채우면 그 값이 조건으로 실린다. */
  it('승인 유형 코드가 없으면 싣지 않고, 있으면 그대로 싣는다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1, null).approvalTypeCode).toBeUndefined();
    expect(
      toRequestListQuery(EMPTY_FILTERS, true, 1, 'GOODS_ISSUE_DISPOSAL').approvalTypeCode,
    ).toBe('GOODS_ISSUE_DISPOSAL');
  });

  it('공백만인 유형 코드는 싣지 않는다 — 그 값으로는 아무것도 걸리지 않는다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1, '   ').approvalTypeCode).toBeUndefined();
  });

  it('상신일을 `YYYY-MM-DD` 그대로 싣는다 — 계약이 `format: date`다', () => {
    const query = toRequestListQuery(
      filtersOf({ from: '2026-08-01', to: '2026-08-31' }),
      true,
      1,
      null,
    );

    expect(query.requestedAtFrom).toBe('2026-08-01');
    expect(query.requestedAtTo).toBe('2026-08-31');
  });

  it('실존하지 않는 날짜는 요청에 실리지 않는다 — 보내기 전에 화면이 막는다', () => {
    const query = toRequestListQuery(filtersOf({ from: '2026-02-31' }), true, 1, null);

    expect(query.requestedAtFrom).toBeUndefined();
  });

  it('공백만인 검색어는 실리지 않고, 앞뒤 공백은 걷어 낸다', () => {
    expect(toRequestListQuery(filtersOf({ q: '   ' }), true, 1, null).q).toBeUndefined();
    expect(toRequestListQuery(filtersOf({ q: ' SYNTH ' }), true, 1, null).q).toBe('SYNTH');
  });

  it('첫 쪽은 싣지 않는다 — 생략이 곧 첫 쪽이다', () => {
    expect(toRequestListQuery(EMPTY_FILTERS, true, 1, null).page).toBeUndefined();
    expect(toRequestListQuery(EMPTY_FILTERS, true, 3, null).page).toBe(3);
  });

  it('걸린 것이 없으면 고정 축 둘만 실린다', () => {
    expect(Object.keys(toRequestListQuery(EMPTY_FILTERS, true, 1, null)).sort()).toEqual([
      'assignedToMe',
      'pendingOnly',
    ]);
  });

  /** 이 화면은 상신하지 않는다 — 「내가 올린 것」 축이 존재할 수 없다. */
  it('`requestedByMe`·`myTurnOnly`·`size`를 싣지 않는다', () => {
    const query = toRequestListQuery(EMPTY_FILTERS, true, 1, 'GOODS_ISSUE_DISPOSAL') as Record<
      string,
      unknown
    >;

    expect(query.requestedByMe).toBeUndefined();
    expect(query.myTurnOnly).toBeUndefined();
    expect(query.size).toBeUndefined();
  });

  /** 대상 유형·번호로 거르는 파라미터가 계약에 있으나 이 화면의 축이 아니다. */
  it('대상으로 거르지 않는다', () => {
    const query = toRequestListQuery(EMPTY_FILTERS, true, 1, null) as Record<string, unknown>;

    expect(query.targetTypeCode).toBeUndefined();
    expect(query.targetId).toBeUndefined();
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나가 선다', () => {
    const chips = toFilterChips(
      filtersOf({
        statusCode: 'SAMPLE-STATUS-OPEN',
        from: '2026-08-01',
        to: '2026-08-31',
        q: 'SYNTH',
      }),
    );

    expect(chips.map((chip) => chip.key)).toEqual(['statusCode', 'period', 'q']);
    expect(chips[0]?.label).toBe(t.filters.chipStatus('SAMPLE-STATUS-OPEN'));
    expect(chips[1]?.label).toBe(t.filters.chipPeriod('2026-08-01', '2026-08-31'));
    expect(chips[2]?.label).toBe(t.filters.chipKeyword('SYNTH'));
  });

  it('걸린 조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(EMPTY_FILTERS)).toEqual([]);
  });

  /** 한쪽만 있는 구간을 양쪽 있는 것처럼 적지 않는다 — 주소를 손으로 고치면 실제로 생긴다. */
  it('한쪽만 있는 구간은 그 사실대로 적는다', () => {
    expect(toFilterChips(filtersOf({ from: '2026-08-01' }))[0]?.label).toBe(
      t.filters.chipPeriodFrom('2026-08-01'),
    );
    expect(toFilterChips(filtersOf({ to: '2026-08-31' }))[0]?.label).toBe(
      t.filters.chipPeriodTo('2026-08-31'),
    );
  });

  it('제거 버튼의 이름이 조건마다 다르다 — 「제거」가 둘이면 무엇을 푸는지 알 수 없다', () => {
    const chips = toFilterChips(filtersOf({ statusCode: 'SAMPLE-STATUS-OPEN', q: 'SYNTH' }));
    const names = chips.map((chip) => chip.removeLabel);

    expect(new Set(names).size).toBe(names.length);
  });

  it('공백만인 검색어는 칩이 되지 않는다', () => {
    expect(toFilterChips(filtersOf({ q: '   ' }))).toEqual([]);
  });

  /** 확인칸은 조건이 아니라 조회 범위라 칩이 되지 않는다 — 자기 컨트롤이 상태를 보인다. */
  it('「결재 대기만 보기」는 칩이 아니다', () => {
    expect(toFilterChips(EMPTY_FILTERS)).toEqual([]);
  });
});

describe('clearFilter', () => {
  it('조건 하나만 푼다', () => {
    const filters = filtersOf({ statusCode: 'SAMPLE-STATUS-OPEN', q: 'SYNTH' });

    expect(clearFilter(filters, 'q')).toEqual({ ...filters, q: '' });
  });

  it('기간은 두 끝을 함께 푼다 — 칩 하나가 두 필드를 대표한다', () => {
    const filters = filtersOf({ from: '2026-08-01', to: '2026-08-31', q: 'SYNTH' });

    expect(clearFilter(filters, 'period')).toEqual({ ...filters, from: '', to: '' });
  });
});
