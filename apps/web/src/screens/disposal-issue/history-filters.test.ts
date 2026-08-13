import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  clearIssueFilter,
  DEFAULT_ISSUE_FILTERS,
  HISTORY_SELECTION_KEYS,
  readIssueFilters,
  readIssuePage,
  readSelectedIssueId,
  toHistorySearchParams,
  toIssueFilterChips,
  toIssueFilterQuery,
  type IssueFilters,
} from './history-filters';

const t = messages.disposalIssue;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<IssueFilters> = {}): IssueFilters => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...overrides,
});

describe('readIssueFilters — 주소에서 이력 조건 읽기', () => {
  it('빈 주소는 아무 조건도 걸지 않는다', () => {
    expect(readIssueFilters(params(''))).toEqual(DEFAULT_ISSUE_FILTERS);
  });

  it('일곱 키를 각자의 자리로 읽는다', () => {
    const read = readIssueFilters(
      params('ifrom=2026-08-01&ito=2026-08-31&ity=CODE_A&irs=CODE_B&ist=CODE_C&iq=GI-2026'),
    );

    expect(read).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      issueType: 'CODE_A',
      reason: 'CODE_B',
      status: 'CODE_C',
      q: 'GI-2026',
    });
  });

  /*
   * **대상 조건과 키가 갈려 있어야 한다.** 한 주소에 두 탭의 조건이 함께 실리므로, 키가
   * 겹치면 한 탭의 조회가 다른 탭의 조건으로 나간다.
   */
  it('대상 조건 키를 이력 조건으로 읽지 않는다', () => {
    const read = readIssueFilters(params('from=2026-08-01&to=2026-08-31&ty=X&st=Y&q=Z'));

    expect(read).toEqual(DEFAULT_ISSUE_FILTERS);
  });

  /* 자릿수는 맞지만 없는 날이다 — 그대로 보내면 조회가 늘 실패하는데 조건은 걸린 것처럼 보인다. */
  it('실존하지 않는 날짜는 조건이 아니다', () => {
    expect(readIssueFilters(params('ifrom=2026-02-31')).from).toBe('');
    expect(readIssueFilters(params('ito=2026-13-01')).to).toBe('');
    expect(readIssueFilters(params('ifrom=2026-8-1')).from).toBe('');
    /* 짝 방향 — 실존하는 날짜는 통과한다. */
    expect(readIssueFilters(params('ifrom=2026-02-28')).from).toBe('2026-02-28');
  });

  it('공백만인 코드 조건은 조건이 아니다', () => {
    const read = readIssueFilters(params('ity=%20%20&irs=%20&ist=%20%20'));

    expect(read.issueType).toBe('');
    expect(read.reason).toBe('');
    expect(read.status).toBe('');
  });

  /*
   * 검색어만 원문 그대로 읽는다 — 이 값은 검색칸에 그대로 서야 한다. 다듬기는 쓰는 자리
   * (요청 조립·칩·주소)가 한다.
   */
  it('검색어는 원문 그대로 읽는다', () => {
    expect(readIssueFilters(params('iq=%20%20')).q).toBe('  ');
  });
});

describe('readIssuePage · readSelectedIssueId', () => {
  it('쪽은 이력 전용 키에서 읽는다', () => {
    expect(readIssuePage(params('ipage=3'))).toBe(3);
    /* 대상 탭의 쪽을 이력 쪽으로 읽으면 두 목록이 함께 넘어간다. */
    expect(readIssuePage(params('page=3'))).toBe(1);
  });

  it('이상한 쪽은 첫 쪽으로 본다', () => {
    expect(readIssuePage(params('ipage=0'))).toBe(1);
    expect(readIssuePage(params('ipage=-1'))).toBe(1);
    expect(readIssuePage(params('ipage=xyz'))).toBe(1);
    expect(readIssuePage(params(''))).toBe(1);
  });

  it('고른 품의를 gi에서 읽는다', () => {
    expect(readSelectedIssueId(params('gi=9501'))).toBe(9501);
    expect(readSelectedIssueId(params('gi=xyz'))).toBeNull();
    expect(readSelectedIssueId(params('gi=0'))).toBeNull();
    expect(readSelectedIssueId(params(''))).toBeNull();
    /* 대상 탭의 선택을 품의 선택으로 읽지 않는다. */
    expect(readSelectedIssueId(params('gr=9001'))).toBeNull();
  });

  it('키 이름을 한 곳에서만 적는다', () => {
    expect(HISTORY_SELECTION_KEYS.goodsIssue).toBe('gi');
  });
});

describe('toHistorySearchParams — 조건을 주소로', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(toHistorySearchParams(DEFAULT_ISSUE_FILTERS, 1).toString()).toBe('');
  });

  it('채운 조건만 실린다', () => {
    const search = toHistorySearchParams(filters({ from: '2026-08-01', status: 'CODE_C' }), 1);

    expect([...search.keys()].sort()).toEqual(['ifrom', 'ist']);
  });

  it('첫 쪽은 적지 않고 다음 쪽부터 적는다', () => {
    expect(toHistorySearchParams(DEFAULT_ISSUE_FILTERS, 1).has('ipage')).toBe(false);
    expect(toHistorySearchParams(DEFAULT_ISSUE_FILTERS, 2).get('ipage')).toBe('2');
  });

  /*
   * **`gi`를 만들지 않는다**(수명 표 9행). 이력 조건·쪽이 바뀌면 고른 품의가 새 결과에 없을
   * 수 있어 함께 비워져야 하고, 그 규칙이 이 함수 하나로 지켜진다.
   */
  it('gi를 만들지 않는다', () => {
    const search = toHistorySearchParams(filters({ status: 'CODE_C' }), 2);

    expect(search.has('gi')).toBe(false);
  });

  it('대상 조건 키를 만들지 않는다', () => {
    const search = toHistorySearchParams(filters({ from: '2026-08-01', q: 'GI' }), 3);

    for (const key of ['from', 'to', 'ty', 'st', 'q', 'page', 'gr', 'tab']) {
      expect(search.has(key)).toBe(false);
    }
  });

  it('공백만인 값은 주소에 남지 않는다', () => {
    const search = toHistorySearchParams(filters({ q: '   ', status: '  ' }), 1);

    expect(search.toString()).toBe('');
  });

  it('읽고 쓴 값이 왕복한다', () => {
    const original = filters({
      from: '2026-08-01',
      to: '2026-08-31',
      issueType: 'CODE_A',
      reason: 'CODE_B',
      status: 'CODE_C',
      q: 'GI-2026',
    });

    expect(readIssueFilters(toHistorySearchParams(original, 1))).toEqual(original);
  });
});

describe('toIssueFilterQuery — 계약 쿼리 이름', () => {
  it('빈 조건은 키를 만들지 않는다', () => {
    expect(toIssueFilterQuery(DEFAULT_ISSUE_FILTERS)).toEqual({});
  });

  it('계약이 쓰는 이름으로 옮긴다', () => {
    expect(
      toIssueFilterQuery(
        filters({
          from: '2026-08-01',
          to: '2026-08-31',
          issueType: 'CODE_A',
          reason: 'CODE_B',
          status: 'CODE_C',
          q: 'GI-2026',
        }),
      ),
    ).toEqual({
      issuedAtFrom: '2026-08-01',
      issuedAtTo: '2026-08-31',
      issueTypeCode: 'CODE_A',
      reasonCode: 'CODE_B',
      statusCode: 'CODE_C',
      q: 'GI-2026',
    });
  });

  /* 반품 축이라 이 화면의 조건이 아니다 — 실으면 폐기 품의가 공급사로 걸러진다. */
  it('공급사 조건을 만들지 않는다', () => {
    const query: Record<string, unknown> = { ...toIssueFilterQuery(filters({ q: 'GI' })) };

    expect(query).not.toHaveProperty('supplierId');
    expect(query).not.toHaveProperty('sourceWarehouseId');
  });

  it('실존하지 않는 날짜·공백만인 값은 요청에 실리지 않는다', () => {
    expect(toIssueFilterQuery(filters({ from: '2026-02-31', q: '   ' }))).toEqual({});
  });

  it('앞뒤 공백은 다듬어 싣는다', () => {
    expect(toIssueFilterQuery(filters({ q: '  GI-2026  ' })).q).toBe('GI-2026');
  });
});

describe('toIssueFilterChips — 걸린 조건이 보인다', () => {
  it('조건이 없으면 칩도 없다', () => {
    expect(toIssueFilterChips(DEFAULT_ISSUE_FILTERS)).toEqual([]);
  });

  it('기간은 칩 하나이고 세 갈래로 말한다', () => {
    expect(toIssueFilterChips(filters({ from: '2026-08-01', to: '2026-08-31' }))[0]?.label).toBe(
      t.historyFilters.chipPeriodBoth('2026-08-01', '2026-08-31'),
    );
    expect(toIssueFilterChips(filters({ from: '2026-08-01' }))[0]?.label).toBe(
      t.historyFilters.chipPeriodFrom('2026-08-01'),
    );
    expect(toIssueFilterChips(filters({ to: '2026-08-31' }))[0]?.label).toBe(
      t.historyFilters.chipPeriodTo('2026-08-31'),
    );
  });

  /*
   * 날짜 컨트롤이 값을 개별로 비우는 수단을 주지 않아 기간을 푸는 길이 「초기화」뿐이다.
   * ×를 달면 눌러도 값이 남아 **칩은 사라졌는데 조건은 걸려 있는** 상태가 된다.
   */
  it('기간 칩에만 해제 버튼이 없다', () => {
    const chips = toIssueFilterChips(
      filters({ from: '2026-08-01', issueType: 'CODE_A', reason: 'CODE_B', status: 'CODE_C', q: 'GI' }),
    );

    expect(chips.find((chip) => chip.key === 'period')?.removeLabel).toBeNull();
    expect(
      chips.filter((chip) => chip.key !== 'period').every((chip) => chip.removeLabel !== null),
    ).toBe(true);
  });

  it('칩 차례가 조건 줄의 컨트롤 차례와 같다', () => {
    const chips = toIssueFilterChips(
      filters({ from: '2026-08-01', issueType: 'CODE_A', reason: 'CODE_B', status: 'CODE_C', q: 'GI' }),
    );

    expect(chips.map((chip) => chip.key)).toEqual(['period', 'issueType', 'reason', 'status', 'q']);
  });

  /*
   * **칩의 판정 기준과 요청의 판정 기준이 같아야 한다.** 갈리면 손으로 고친 주소에서
   * 조건은 걸리지 않는데 칩만 뜨고, 사용자는 결과가 그대로인 이유를 읽을 수 없다.
   */
  it('요청에 실리지 않는 값은 칩도 되지 않는다', () => {
    expect(toIssueFilterChips(filters({ from: '2026-02-31', q: '  ', status: ' ' }))).toEqual([]);
  });
});

describe('clearIssueFilter — 칩 하나 풀기', () => {
  it('그 조건만 비운다', () => {
    const before = filters({ issueType: 'CODE_A', reason: 'CODE_B' });

    expect(clearIssueFilter(before, 'issueType')).toEqual(filters({ reason: 'CODE_B' }));
  });

  it('원본을 고치지 않는다', () => {
    const before = filters({ status: 'CODE_C' });

    clearIssueFilter(before, 'status');

    expect(before.status).toBe('CODE_C');
  });
});
