import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADJUSTMENT_FILTERS,
  HISTORY_SELECTION_KEYS,
  clearAdjustmentFilter,
  readAdjustmentFilters,
  readAdjustmentPage,
  readSelectedAdjustmentId,
  toAdjustmentFilterChips,
  toAdjustmentFilterQuery,
  toHistorySearchParams,
  type AdjustmentFilters,
} from './history-filters';

const t = messages.stockAdjust;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<AdjustmentFilters> = {}): AdjustmentFilters => ({
  ...DEFAULT_ADJUSTMENT_FILTERS,
  ...overrides,
});

/**
 * 화면이 풀어 넘기는 이름. **번호가 들어 있지 않은 이름을 쓴다** — 이름 자체가 그 숫자를
 * 담고 있으면 「내부 번호가 새지 않는다」를 재는 음성 단언이 그 이름 때문에 무너진다.
 */
const NAMES = { count: 'SAMPLE-IC-A · 2026-08-17' };

describe('DEFAULT_ADJUSTMENT_FILTERS — 아무 조건도 걸지 않은 상태', () => {
  it('기본 기간을 심지 않는다 — 심으면 첫 조회에 날짜가 실리고 사용자가 그 사정을 못 읽는다', () => {
    expect(DEFAULT_ADJUSTMENT_FILTERS).toEqual({
      count: '',
      reason: '',
      status: '',
      from: '',
      to: '',
    });
  });

  /**
   * ⛔ **승인 대기 조건을 만들지 않는다**(D-3 · C41). 계약에 남아 있는 조건이라 자리를 두면
   * 저절로 실린다 — 조건 목록에 그 이름이 **아예 없다**는 것이 이 화면의 방어다.
   */
  it('조건이 넷뿐이다 — 승인 대기 조건이 목록에 없다', () => {
    expect(Object.keys(DEFAULT_ADJUSTMENT_FILTERS)).toEqual([
      'count',
      'reason',
      'status',
      'from',
      'to',
    ]);
    expect(Object.keys(DEFAULT_ADJUSTMENT_FILTERS)).not.toContain('pendingApprovalOnly');
  });
});

describe('readAdjustmentFilters — 주소가 정본이다', () => {
  it('네 조건을 주소에서 읽는다', () => {
    expect(
      readAdjustmentFilters(
        params('?hc=9101&hrs=SAMPLE_AR_A&hst=SAMPLE_ST_A&hfrom=2026-08-01&hto=2026-08-18'),
      ),
    ).toEqual({
      count: '9101',
      reason: 'SAMPLE_AR_A',
      status: 'SAMPLE_ST_A',
      from: '2026-08-01',
      to: '2026-08-18',
    });
  });

  /**
   * **등록 탭의 `count`와 키가 겹치지 않는다.** 겹치면 재고실사에서 넘어온 주소가 이력 조회의
   * 조건으로 그대로 실려, 사용자가 걸지 않은 조건으로 목록이 좁혀진다.
   */
  it('등록 탭의 진입 맥락(`count`)을 이력 조건으로 읽지 않는다', () => {
    expect(readAdjustmentFilters(params('?count=9101')).count).toBe('');
  });

  it.each(['abc', '0', '-3', '1e21', '9'.repeat(22)])(
    '조건이 될 수 없는 실사 번호 %o은 없는 것으로 읽는다',
    (raw) => {
      expect(readAdjustmentFilters(params(`?hc=${raw}`)).count).toBe('');
    },
  );

  it.each(['2026-13-01', '2026-02-31', '20260801', '2026-8-1'])(
    '있는 날짜가 아닌 %o은 조건이 아니다 — 보내면 조회가 늘 실패하는데 화면에는 걸린 것처럼 보인다',
    (raw) => {
      expect(readAdjustmentFilters(params(`?hfrom=${raw}`)).from).toBe('');
    },
  );

  it('공백만 친 코드는 조건이 아니다', () => {
    expect(readAdjustmentFilters(params('?hrs=%20%20&hst=%20')).reason).toBe('');
    expect(readAdjustmentFilters(params('?hrs=%20%20&hst=%20')).status).toBe('');
  });
});

describe('readAdjustmentPage — 쪽', () => {
  it('주소가 가리키는 쪽을 읽는다', () => {
    expect(readAdjustmentPage(params('?hpage=3'))).toBe(3);
  });

  it.each(['', '0', 'abc', '-1'])('이상한 값 %o은 첫 쪽으로 본다', (raw) => {
    expect(readAdjustmentPage(params(`?hpage=${raw}`))).toBe(1);
  });
});

describe('readSelectedAdjustmentId — 고른 전표', () => {
  it('고른 전표 번호를 읽는다', () => {
    expect(readSelectedAdjustmentId(params(`?${HISTORY_SELECTION_KEYS.adjustment}=9301`))).toBe(
      9301,
    );
  });

  it('없거나 이상한 값이면 고른 것이 없다', () => {
    expect(readSelectedAdjustmentId(params(''))).toBeNull();
    expect(
      readSelectedAdjustmentId(params(`?${HISTORY_SELECTION_KEYS.adjustment}=abc`)),
    ).toBeNull();
  });
});

describe('toHistorySearchParams — 조건을 주소로', () => {
  it('빈 조건은 키 자체를 두지 않는다 — 주소가 조건을 그대로 드러낸다', () => {
    expect(toHistorySearchParams(DEFAULT_ADJUSTMENT_FILTERS, 1).toString()).toBe('');
  });

  it('첫 쪽이면 쪽을 적지 않는다 — 같은 화면의 주소가 두 가지가 되지 않게', () => {
    const written = toHistorySearchParams(filters({ reason: 'SAMPLE_AR_A' }), 1);

    expect(written.get('hrs')).toBe('SAMPLE_AR_A');
    expect(written.get('hpage')).toBeNull();
  });

  it('둘째 쪽부터 쪽이 실린다', () => {
    expect(toHistorySearchParams(DEFAULT_ADJUSTMENT_FILTERS, 2).get('hpage')).toBe('2');
  });

  /**
   * **고른 전표를 이 모듈이 만들지 않는다.** 조건·쪽이 바뀌면 그 전표가 새 결과에 없을 수
   * 있어 함께 비워져야 한다 — 고르는 쪽만 이 결과에 덧붙인다.
   */
  it('고른 전표 키를 만들지 않는다 — 조건이 바뀌면 저절로 풀린다', () => {
    const written = toHistorySearchParams(filters({ reason: 'SAMPLE_AR_A' }), 3);

    expect(written.get(HISTORY_SELECTION_KEYS.adjustment)).toBeNull();
  });

  it('등록 탭의 진입 맥락 키를 만들지 않는다 — 두 탭의 조건을 합치는 것은 화면 한 문이 한다', () => {
    expect(toHistorySearchParams(filters({ count: '9101' }), 1).get('count')).toBeNull();
  });

  it('읽기와 쓰기가 서로를 되돌린다 — 공유한 주소가 같은 조건을 세운다', () => {
    const seeded = filters({
      count: '9101',
      reason: 'SAMPLE_AR_A',
      status: 'SAMPLE_ST_A',
      from: '2026-08-01',
      to: '2026-08-18',
    });

    expect(readAdjustmentFilters(toHistorySearchParams(seeded, 4))).toEqual(seeded);
    expect(readAdjustmentPage(toHistorySearchParams(seeded, 4))).toBe(4);
  });
});

describe('toAdjustmentFilterQuery — 계약이 쓰는 이름', () => {
  it('조건이 없으면 아무것도 싣지 않는다', () => {
    expect(toAdjustmentFilterQuery(DEFAULT_ADJUSTMENT_FILTERS)).toEqual({});
  });

  it('네 조건이 계약 이름으로 실린다 — 실사 번호는 수로 나간다', () => {
    expect(
      toAdjustmentFilterQuery(
        filters({
          count: '9101',
          reason: 'SAMPLE_AR_A',
          status: 'SAMPLE_ST_A',
          from: '2026-08-01',
          to: '2026-08-18',
        }),
      ),
    ).toEqual({
      inventoryCountId: 9101,
      reasonCode: 'SAMPLE_AR_A',
      statusCode: 'SAMPLE_ST_A',
      adjustedAtFrom: '2026-08-01',
      adjustedAtTo: '2026-08-18',
    });
  });

  /**
   * ⛔ **C41의 자리다.** 계약에 남아 있는 승인 대기 조건을 **어떤 값으로도** 싣지 않는다 —
   * 거짓으로 실어도 그 조건이 요청 URL에 서고, 그러면 이 화면에 없는 탭이 계약 수준에서
   * 되살아난다.
   */
  it('승인 대기 조건을 어떤 값으로도 싣지 않는다', () => {
    const query = toAdjustmentFilterQuery(filters({ reason: 'SAMPLE_AR_A' }));

    expect(Object.keys(query)).toEqual(['reasonCode']);
    expect(query).not.toHaveProperty('pendingApprovalOnly');
  });

  it('있는 날짜가 아니면 요청에도 실리지 않는다 — 칩과 요청의 잣대가 같다', () => {
    expect(toAdjustmentFilterQuery(filters({ from: '2026-02-31' }))).toEqual({});
  });
});

describe('toAdjustmentFilterChips — 걸린 조건을 눈에 보이게', () => {
  it('조건이 없으면 칩도 없다', () => {
    expect(toAdjustmentFilterChips(DEFAULT_ADJUSTMENT_FILTERS, NAMES)).toEqual([]);
  });

  /** **실사는 번호가 아니라 이름으로 적는다**(`omf-mes#44`) — 화면이 풀어 넘긴다. */
  it('실사 칩에 내부 번호가 담기지 않는다', () => {
    const [chip] = toAdjustmentFilterChips(filters({ count: '9101' }), NAMES);

    expect(chip?.label).toBe(t.historyFilters.chipCount(NAMES.count));
    expect(chip?.label).not.toContain('9101');
  });

  it('기간은 칩 하나다 — 한쪽만 넣은 기간도 조건이라 세 갈래로 갈린다', () => {
    expect(
      toAdjustmentFilterChips(filters({ from: '2026-08-01', to: '2026-08-18' }), NAMES)[0],
    ).toEqual({
      key: 'period',
      label: t.historyFilters.chipPeriodBoth('2026-08-01', '2026-08-18'),
      removeLabel: null,
    });
    expect(toAdjustmentFilterChips(filters({ from: '2026-08-01' }), NAMES)[0]?.label).toBe(
      t.historyFilters.chipPeriodFrom('2026-08-01'),
    );
    expect(toAdjustmentFilterChips(filters({ to: '2026-08-18' }), NAMES)[0]?.label).toBe(
      t.historyFilters.chipPeriodTo('2026-08-18'),
    );
  });

  it('기간 칩에는 ×가 없다 — 날짜 컨트롤이 값을 개별로 비우는 수단을 주지 않는다', () => {
    const chips = toAdjustmentFilterChips(filters({ from: '2026-08-01' }), NAMES);

    expect(chips[0]?.removeLabel).toBeNull();
  });

  /**
   * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소에서
   * 조건은 걸리지 않는데 칩만 뜬다.
   */
  it.each(['?hfrom=2026-13-01', '?hrs=%20', '?hc=abc'])(
    '조건이 되지 않는 %o에는 칩도 서지 않는다',
    (search) => {
      expect(toAdjustmentFilterChips(readAdjustmentFilters(params(search)), NAMES)).toEqual([]);
    },
  );

  it('차례가 조건 줄의 컨트롤 차례와 같다', () => {
    const chips = toAdjustmentFilterChips(
      filters({
        count: '9101',
        reason: 'SAMPLE_AR_A',
        status: 'SAMPLE_ST_A',
        from: '2026-08-01',
      }),
      NAMES,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['period', 'count', 'reason', 'status']);
  });
});

describe('clearAdjustmentFilter — 칩 하나를 푼다', () => {
  it('그 조건만 비우고 나머지는 그대로 둔다', () => {
    const seeded = filters({ count: '9101', reason: 'SAMPLE_AR_A', from: '2026-08-01' });

    expect(clearAdjustmentFilter(seeded, 'reason')).toEqual({ ...seeded, reason: '' });
  });
});
