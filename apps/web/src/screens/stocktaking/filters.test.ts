import { describe, expect, it } from 'vitest';

import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedCountId,
  readSelectedLocationId,
  SELECTION_KEYS,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type CountFilters,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<CountFilters> = {}): CountFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

const NAMES = { warehouse: 'SAMPLE-WH-01 · 합성 창고 가' };

describe('readFilters', () => {
  it('주소의 조건 여섯을 읽는다', () => {
    const read = readFilters(
      params('wh=9101&from=2026-08-01&to=2026-08-31&ty=SAMPLE_COUNT_TYPE_A&st=SAMPLE_COUNT_STATUS_A&prog=1'),
    );

    expect(read).toEqual({
      warehouse: '9101',
      from: '2026-08-01',
      to: '2026-08-31',
      countType: 'SAMPLE_COUNT_TYPE_A',
      status: 'SAMPLE_COUNT_STATUS_A',
      inProgressOnly: true,
    });
  });

  it('키가 없으면 조건을 걸지 않는다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
  });

  /*
   * 주소는 **손으로 고쳐지는 자리**다. 정수가 아닌 창고 번호를 그대로 `Number()`에 넘기면
   * `NaN`이 요청 URL에 실려 조회 전체가 실패하는데, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 창고 번호는 조건으로 받지 않는다', () => {
    expect(readFilters(params('wh=abc')).warehouse).toBe('');
    expect(readFilters(params('wh=0')).warehouse).toBe('');
    expect(readFilters(params('wh=-1')).warehouse).toBe('');
    expect(readFilters(params('wh=1.5')).warehouse).toBe('');
  });

  /*
   * **자릿수뿐 아니라 실제로 있는 날짜인지도 본다.** `2026-02-31`은 자릿수가 맞지만 없는 날이라
   * 그대로 보내면 조회가 늘 실패하는데 화면에는 조건이 걸린 것처럼 보인다.
   */
  it('형식이 아니거나 없는 날짜는 조건으로 받지 않는다', () => {
    expect(readFilters(params('from=2026-13-01')).from).toBe('');
    expect(readFilters(params('from=2026-02-31')).from).toBe('');
    expect(readFilters(params('to=20260801')).to).toBe('');
    /* 짝 방향 — 있는 날짜는 그대로 통과한다. */
    expect(readFilters(params('from=2026-02-28')).from).toBe('2026-02-28');
  });

  it('공백만 친 코드는 조건이 아니다', () => {
    expect(readFilters(params('ty=%20%20')).countType).toBe('');
    expect(readFilters(params('st=%20')).status).toBe('');
  });

  /*
   * **켜짐을 나타내는 값은 하나뿐이다**(저장소 전례 `ON = '1'`). 다른 값은 꺼진 것으로 본다 —
   * 주소를 손으로 고쳐도 「무엇이 참인가」가 갈리지 않는다.
   */
  it('진행 중만은 1일 때만 켜진다', () => {
    expect(readFilters(params('prog=1')).inProgressOnly).toBe(true);
    expect(readFilters(params('prog=maybe')).inProgressOnly).toBe(false);
    expect(readFilters(params('prog=0')).inProgressOnly).toBe(false);
    expect(readFilters(params('prog=true')).inProgressOnly).toBe(false);
  });
});

describe('readPage', () => {
  it('쪽 번호를 읽고 이상한 값은 첫 쪽으로 본다', () => {
    expect(readPage(params('page=3'))).toBe(3);
    expect(readPage(params(''))).toBe(1);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-1'))).toBe(1);
    expect(readPage(params('page=xyz'))).toBe(1);
  });
});

describe('readSelectedCountId · readSelectedLocationId', () => {
  it('고른 번호를 읽고 이상한 값은 고르지 않은 것으로 본다', () => {
    expect(readSelectedCountId(params('ct=9001'))).toBe(9001);
    expect(readSelectedCountId(params('ct=xyz'))).toBeNull();
    expect(readSelectedCountId(params(''))).toBeNull();
    expect(readSelectedLocationId(params('loc=9701'))).toBe(9701);
    expect(readSelectedLocationId(params('loc=0'))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 싣는다', () => {
    const search = toSearchParams(
      filters({ warehouse: '9101', from: '2026-08-01', countType: 'SAMPLE_COUNT_TYPE_A' }),
      1,
    );

    expect(search.get('wh')).toBe('9101');
    expect(search.get('from')).toBe('2026-08-01');
    expect(search.get('ty')).toBe('SAMPLE_COUNT_TYPE_A');
    expect(search.has('to')).toBe(false);
    expect(search.has('st')).toBe(false);
  });

  /** 참일 때만 싣는다 — 꺼진 조건을 주소에 적으면 걸리지 않은 조건이 걸린 것처럼 보인다. */
  it('진행 중만은 참일 때만 주소에 실린다', () => {
    expect(toSearchParams(filters({ inProgressOnly: true }), 1).get('prog')).toBe('1');
    expect(toSearchParams(filters({ inProgressOnly: false }), 1).has('prog')).toBe(false);
  });

  it('첫 쪽이면 쪽 번호를 적지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).has('page')).toBe(false);
    expect(toSearchParams(DEFAULT_FILTERS, 2).get('page')).toBe('2');
  });

  /*
   * **`ct`·`loc`를 만들지 않는 것이 수명 표 1~3행의 구현이다**(계획 결정 3의 구현 규칙 1).
   * 조건·쪽이 바뀌면 고른 실사와 위치가 새 결과에 없을 수 있어 함께 비워져야 하고,
   * 고르는 쪽만 이 결과에 덧붙인다.
   */
  it('고른 실사·위치를 만들지 않는다', () => {
    const search = toSearchParams(filters({ warehouse: '9101' }), 2);

    expect(search.has(SELECTION_KEYS.count)).toBe(false);
    expect(search.has(SELECTION_KEYS.location)).toBe(false);
  });

  /** 조건을 걸러 내는 잣대가 읽기와 같다 — 다르면 주소에 못 쓰는 값이 남는다. */
  it('이상한 값은 주소에 남기지 않는다', () => {
    const search = toSearchParams(
      filters({ warehouse: 'abc', from: '2026-13-01', status: '   ' }),
      1,
    );

    expect(search.has('wh')).toBe(false);
    expect(search.has('from')).toBe(false);
    expect(search.has('st')).toBe(false);
  });
});

describe('toFilterQuery', () => {
  it('채운 조건만 요청 쿼리에 싣는다', () => {
    const query = toFilterQuery(
      filters({
        warehouse: '9101',
        from: '2026-08-01',
        to: '2026-08-31',
        countType: 'SAMPLE_COUNT_TYPE_A',
        status: 'SAMPLE_COUNT_STATUS_A',
        inProgressOnly: true,
      }),
    );

    expect(query).toEqual({
      warehouseId: 9101,
      plannedDateFrom: '2026-08-01',
      plannedDateTo: '2026-08-31',
      countTypeCode: 'SAMPLE_COUNT_TYPE_A',
      statusCode: 'SAMPLE_COUNT_STATUS_A',
      inProgressOnly: true,
    });
  });

  /* **기본 기간을 심지 않는다**(W-01-09가 세운 규칙) — 빈 조건은 키 자체가 없다. */
  it('조건이 없으면 쿼리가 비어 있다', () => {
    expect(toFilterQuery(DEFAULT_FILTERS)).toEqual({});
  });

  it('진행 중만이 꺼져 있으면 요청에 싣지 않는다', () => {
    expect(toFilterQuery(filters({ inProgressOnly: false }))).toEqual({});
  });

  it('정수가 아닌 창고 번호를 요청에 싣지 않는다', () => {
    expect(toFilterQuery(filters({ warehouse: 'abc' }))).toEqual({});
  });

  /** 창고 번호는 **수로** 실린다 — 계약이 정수를 요구한다. */
  it('창고 번호를 수로 싣는다', () => {
    expect(toFilterQuery(filters({ warehouse: '9101' })).warehouseId).toBe(9101);
  });
});

describe('toFilterChips', () => {
  it('적용된 조건마다 칩 하나를 만든다', () => {
    const chips = toFilterChips(
      filters({ warehouse: '9101', from: '2026-08-01', to: '2026-08-31', inProgressOnly: true }),
      NAMES,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['warehouse', 'period', 'inProgress']);
    expect(chips[0]?.label).toBe('창고: SAMPLE-WH-01 · 합성 창고 가');
    expect(chips[1]?.label).toBe('계획일: 2026-08-01 ~ 2026-08-31');
  });

  it('한쪽만 넣은 기간도 칩 하나로 낸다', () => {
    expect(toFilterChips(filters({ from: '2026-08-01' }), NAMES)[0]?.label).toBe(
      '계획일: 2026-08-01부터',
    );
    expect(toFilterChips(filters({ to: '2026-08-31' }), NAMES)[0]?.label).toBe(
      '계획일: 2026-08-31까지',
    );
  });

  /*
   * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소에서
   * **조건은 걸리지 않는데 칩만 뜬다** — 사용자는 칩을 보고 조건이 걸린 줄 안다.
   */
  it('요청에 실리지 않는 값으로는 칩을 만들지 않는다', () => {
    expect(toFilterChips(filters({ warehouse: 'abc', from: '2026-13-01', status: ' ' }), NAMES)).toEqual(
      [],
    );
  });

  it('조건이 없으면 칩이 없다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, NAMES)).toEqual([]);
  });

  /** 제거 버튼의 접근 이름이 조건마다 다르다 — 「제거」가 둘이면 어느 조건을 푸는지 알 수 없다. */
  it('제거 버튼 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({
        warehouse: '9101',
        from: '2026-08-01',
        countType: 'SAMPLE_COUNT_TYPE_A',
        status: 'SAMPLE_COUNT_STATUS_A',
        inProgressOnly: true,
      }),
      NAMES,
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('clearFilter', () => {
  it('칩 하나를 푼다', () => {
    const next = clearFilter(filters({ warehouse: '9101', status: 'SAMPLE_COUNT_STATUS_A' }), 'warehouse');

    expect(next.warehouse).toBe('');
    expect(next.status).toBe('SAMPLE_COUNT_STATUS_A');
  });

  /* 기간은 칩이 하나다 — 한쪽만 풀면 칩을 지웠는데 조건이 남아 결과가 그대로다. */
  it('기간은 두 조건을 함께 푼다', () => {
    const next = clearFilter(filters({ from: '2026-08-01', to: '2026-08-31' }), 'period');

    expect(next.from).toBe('');
    expect(next.to).toBe('');
  });

  it('진행 중만은 꺼진 상태로 되돌린다', () => {
    expect(clearFilter(filters({ inProgressOnly: true }), 'inProgress').inProgressOnly).toBe(false);
  });
});
