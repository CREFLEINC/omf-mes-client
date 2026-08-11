import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedReceiptId,
  SELECTION_KEYS,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type ReceiptFilters,
} from './filters';

const t = messages.supplierReturn;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<ReceiptFilters> = {}): ReceiptFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

const NAMES = { warehouse: 'SAMPLE-WH-01 · 합성 창고 가' };

describe('readFilters', () => {
  it('주소의 다섯 조건을 읽는다', () => {
    expect(
      readFilters(params('wh=9701&from=2026-08-01&to=2026-08-05&ty=SAMPLE_A&st=SAMPLE_B&q=GR-2026')),
    ).toEqual({
      warehouse: '9701',
      from: '2026-08-01',
      to: '2026-08-05',
      receiptType: 'SAMPLE_A',
      status: 'SAMPLE_B',
      q: 'GR-2026',
    });
  });

  it('키가 없으면 빈 조건이다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
  });

  /*
   * 정수가 아닌 번호를 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려 조회 전체가
   * 실패하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it.each(['abc', '0', '-1', '9.5', ' 9701', ''])('정수가 아닌 wh(%s)를 받지 않는다', (raw) => {
    expect(readFilters(params(`wh=${raw}`)).warehouse).toBe('');
  });

  /**
   * **상한 쪽에서도 같은 실패가 되살아난다.** 자릿수 상한이 없으면 22자리 이상이 통과하고,
   * `Number()`가 그것을 `1e+21`로 바꿔 요청 URL에 지수 표기가 실린다 — 조건이 걸린 것처럼
   * 보이는데 조회가 늘 실패한다.
   */
  it('지수 표기가 될 만큼 긴 번호를 받지 않는다', () => {
    expect(readFilters(params('wh=1000000000000000000000')).warehouse).toBe('');
    expect(readPage(params('page=1000000000000000000000'))).toBe(1);
    expect(readSelectedReceiptId(params('gr=1000000000000000000000'))).toBeNull();
  });

  /* 짝 방향 — 계약의 식별자는 64비트 정수다. 있을 법한 큰 번호는 그대로 받는다. */
  it('안전 정수 범위의 큰 번호는 그대로 받는다', () => {
    expect(readFilters(params('wh=999999999999999')).warehouse).toBe('999999999999999');
    expect(readSelectedReceiptId(params('gr=123456789012'))).toBe(123456789012);
  });

  /* 자릿수가 맞아도 없는 날은 조건이 아니다 — 보내면 조회가 늘 실패하는데 조건은 걸린 듯 보인다. */
  it.each(['2026-13-01', '2026-02-31', '2026-8-6', '20260806', 'yesterday'])(
    '없는 날짜(%s)를 받지 않는다',
    (raw) => {
      expect(readFilters(params(`from=${raw}`)).from).toBe('');
    },
  );

  it('한쪽만 있는 기간을 그대로 받는다', () => {
    expect(readFilters(params('from=2026-08-01')).from).toBe('2026-08-01');
    expect(readFilters(params('from=2026-08-01')).to).toBe('');
  });

  /* 공백만 친 값은 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
  it('공백만인 유형·상태를 다듬는다', () => {
    const read = readFilters(params('ty=%20%20&st=%20'));

    expect(read.receiptType).toBe('');
    expect(read.status).toBe('');
  });
});

describe('readPage', () => {
  it('주소의 쪽을 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it.each(['0', '-1', 'abc', ''])('이상한 쪽(%s)은 첫 쪽으로 본다', (raw) => {
    expect(readPage(params(`page=${raw}`))).toBe(1);
  });
});

describe('readSelectedReceiptId', () => {
  it('고른 전표 번호를 읽는다', () => {
    expect(readSelectedReceiptId(params('gr=9001'))).toBe(9001);
  });

  /* 정수가 아니면 그 경로로 상세를 부를 수 없다 — 부르면 화면이 스스로 만든 실패를 보인다. */
  it.each(['xyz', '0', '-3', '9.5', ''])('정수가 아닌 gr(%s)은 고르지 않은 것으로 본다', (raw) => {
    expect(readSelectedReceiptId(params(`gr=${raw}`))).toBeNull();
  });

  it('주소 키 이름은 한 곳에서만 정한다', () => {
    expect(SELECTION_KEYS.goodsReceipt).toBe('gr');
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 적는다', () => {
    expect(toSearchParams(filters({ warehouse: '9701', q: 'GR-2026' }), 1).toString()).toBe(
      'wh=9701&q=GR-2026',
    );
  });

  it('첫 쪽이면 page를 적지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).toString()).toBe('');
    expect(toSearchParams(DEFAULT_FILTERS, 2).toString()).toBe('page=2');
  });

  /**
   * **`gr`를 만들지 않는다.** 조건·쪽이 바뀌면 고른 전표가 새 결과에 없을 수 있어 함께
   * 비워져야 하고(수명 표 1~3행), 고르는 쪽만 이 결과에 덧붙인다.
   */
  it('고른 전표를 주소에 만들지 않는다', () => {
    const next = toSearchParams(filters({ warehouse: '9701' }), 2);

    expect(next.has(SELECTION_KEYS.goodsReceipt)).toBe(false);
  });

  it('이상한 값은 주소에 적지 않는다', () => {
    const next = toSearchParams(filters({ warehouse: 'abc', from: '2026-13-01', q: '   ' }), 1);

    expect(next.toString()).toBe('');
  });
});

describe('toFilterQuery', () => {
  it('계약 이름으로 옮긴다', () => {
    expect(
      toFilterQuery(
        filters({
          warehouse: '9701',
          from: '2026-08-01',
          to: '2026-08-05',
          receiptType: 'SAMPLE_A',
          status: 'SAMPLE_B',
          q: 'GR-2026',
        }),
      ),
    ).toEqual({
      warehouseId: 9701,
      receiptDateFrom: '2026-08-01',
      receiptDateTo: '2026-08-05',
      receiptTypeCode: 'SAMPLE_A',
      statusCode: 'SAMPLE_B',
      q: 'GR-2026',
    });
  });

  /* 채우지 않은 조건은 키 자체가 없다 — 요청 URL이 조건을 그대로 드러내야 읽을 수 있다. */
  it('빈 조건은 키를 만들지 않는다', () => {
    expect(toFilterQuery(DEFAULT_FILTERS)).toEqual({});
  });

  it('이상한 값은 요청에 싣지 않는다', () => {
    expect(toFilterQuery(filters({ warehouse: 'abc', to: '2026-02-31', q: ' ' }))).toEqual({});
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나를 낸다', () => {
    const chips = toFilterChips(
      filters({ warehouse: '9701', receiptType: 'SAMPLE_A', status: 'SAMPLE_B', q: 'GR' }),
      NAMES,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['warehouse', 'receiptType', 'status', 'q']);
    expect(chips[0]?.label).toBe(t.filters.chipWarehouse(NAMES.warehouse));
  });

  it('걸리지 않은 조건은 칩이 없다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, NAMES)).toEqual([]);
  });

  it('기간은 한쪽만 걸려도 칩 하나다', () => {
    expect(toFilterChips(filters({ from: '2026-08-01' }), NAMES)[0]?.label).toBe(
      t.filters.chipPeriodFrom('2026-08-01'),
    );
    expect(toFilterChips(filters({ to: '2026-08-05' }), NAMES)[0]?.label).toBe(
      t.filters.chipPeriodTo('2026-08-05'),
    );
    expect(toFilterChips(filters({ from: '2026-08-01', to: '2026-08-05' }), NAMES)[0]?.label).toBe(
      t.filters.chipPeriodBoth('2026-08-01', '2026-08-05'),
    );
  });

  /**
   * **기간 칩에는 해제 버튼이 없다**(계획 §13-5 안 A). 날짜 컨트롤이 값을 개별로 비우는
   * 수단을 주지 않아 기간을 푸는 길이 「초기화」뿐이다 — ×를 달면 눌러도 값이 남는다.
   */
  it('기간 칩만 해제 버튼이 없다', () => {
    const chips = toFilterChips(
      filters({ warehouse: '9701', from: '2026-08-01', to: '2026-08-05' }),
      NAMES,
    );

    expect(chips.find((chip) => chip.key === 'period')?.removeLabel).toBeNull();
    expect(chips.find((chip) => chip.key === 'warehouse')?.removeLabel).toBe(
      t.filters.chipRemoveWarehouse,
    );
  });

  /**
   * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소에서
   * 조건은 걸리지 않는데 칩만 뜨고, 사용자는 결과가 그대로인 이유를 읽을 수 없다.
   */
  it('요청에 실리지 않는 값에는 칩을 내지 않는다', () => {
    expect(
      toFilterChips(filters({ warehouse: 'abc', from: '2026-13-01', q: '  ' }), NAMES),
    ).toEqual([]);
  });
});

describe('clearFilter', () => {
  it.each(['warehouse', 'receiptType', 'status', 'q'] as const)('%s 조건 하나만 푼다', (key) => {
    const before = filters({
      warehouse: '9701',
      receiptType: 'SAMPLE_A',
      status: 'SAMPLE_B',
      q: 'GR',
      from: '2026-08-01',
    });
    const after = clearFilter(before, key);

    expect(after[key]).toBe('');
    expect(after.from).toBe('2026-08-01');
  });
});
