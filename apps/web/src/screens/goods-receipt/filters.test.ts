import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedIrId,
  readSelectedLineId,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type IrFilters,
} from './filters';

const t = messages.goodsReceipt;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<IrFilters> = {}): IrFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

describe('DEFAULT_FILTERS', () => {
  /*
   * **M01의 단위 몫** — 기본 기간을 심으면 첫 진입 요청에 날짜가 실리고,
   * 사용자는 왜 그 기간만 보이는지 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('기본 조건에 기간이 심어져 있지 않다', () => {
    expect(DEFAULT_FILTERS).toEqual({ supplier: '', from: '', to: '', status: '', q: '' });
  });
});

describe('readFilters', () => {
  it('주소의 조건을 그대로 읽는다', () => {
    expect(readFilters(params('sup=9101&from=2026-08-01&to=2026-08-31&st=A&q=IR-2026'))).toEqual({
      supplier: '9101',
      from: '2026-08-01',
      to: '2026-08-31',
      status: 'A',
      q: 'IR-2026',
    });
  });

  it('없는 키는 빈 조건으로 읽는다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
  });

  /*
   * **M09** — 정수가 아닌 번호를 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
   * 조회 전체가 400으로 실패하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it.each(['abc', '-1', '1.5', '0', ' 9101'])('정수가 아닌 공급사(%s)는 버린다', (raw) => {
    expect(readFilters(params(`sup=${encodeURIComponent(raw)}`)).supplier).toBe('');
  });

  /*
   * 날짜도 같은 갈래다. `2026-13-45`를 그대로 보내면 조회가 늘 실패하는데
   * 화면에는 조건이 걸린 것처럼 보인다. **자릿수뿐 아니라 실제로 있는 날짜인지도 본다.**
   */
  it.each(['2026-8-1', '20260801', '2026-13-01', '2026-02-31', 'today'])(
    '날짜가 아닌 기간(%s)은 버린다',
    (raw) => {
      expect(readFilters(params(`from=${encodeURIComponent(raw)}`)).from).toBe('');
      expect(readFilters(params(`to=${encodeURIComponent(raw)}`)).to).toBe('');
    },
  );

  it('윤년의 2월 29일은 받는다', () => {
    expect(readFilters(params('from=2028-02-29')).from).toBe('2028-02-29');
  });

  /*
   * **N-1** — 자유 문자열 조건이 둘(검색어·상태 코드)인데 한쪽만 다듬으면
   * `?st=%20`이 `statusCode: ' '`로 요청에 실리고 칩도 「상태:  」로 뜬다.
   */
  it('공백만 친 상태 코드는 조건이 아니다', () => {
    expect(readFilters(params('st=%20%20')).status).toBe('');
    expect(toFilterQuery(filters({ status: '  ' }))).toEqual({});
    expect(toSearchParams(filters({ status: '  ' }), 1).has('st')).toBe(false);
    expect(toFilterChips(filters({ status: '  ' }), { supplier: '' })).toEqual([]);
  });

  it('상태 코드의 앞뒤 공백을 다듬어 싣는다', () => {
    expect(readFilters(params('st=%20SAMPLE_IR_STATUS_A%20')).status).toBe('SAMPLE_IR_STATUS_A');
    expect(toFilterQuery(filters({ status: ' SAMPLE_IR_STATUS_A ' })).statusCode).toBe(
      'SAMPLE_IR_STATUS_A',
    );
  });
});

describe('readPage', () => {
  it('주소의 쪽을 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it.each(['', 'abc', '0', '-2', '1.5'])('이상한 쪽(%s)은 첫 쪽으로 본다', (raw) => {
    expect(readPage(params(raw === '' ? '' : `page=${raw}`))).toBe(1);
  });
});

describe('readSelectedIrId · readSelectedLineId', () => {
  it('고른 전표와 라인을 읽는다', () => {
    expect(readSelectedIrId(params('ir=9001'))).toBe(9001);
    expect(readSelectedLineId(params('line=9401'))).toBe(9401);
  });

  /* **M09의 선택 몫** — 정수가 아니면 경로 조각이 `/undefined`가 되거나 요청이 400이 된다. */
  it.each(['xyz', '0', '-1', '1.5', ''])('정수가 아닌 ir·line(%s)은 없는 것으로 본다', (raw) => {
    const search = raw === '' ? '' : `ir=${raw}&line=${raw}`;

    expect(readSelectedIrId(params(search))).toBeNull();
    expect(readSelectedLineId(params(search))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 적는다', () => {
    const search = toSearchParams(filters({ supplier: '9101', q: 'IR-2026' }), 1);

    expect(search.toString()).toBe('sup=9101&q=IR-2026');
  });

  it('첫 쪽이면 쪽을 적지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).has('page')).toBe(false);
    expect(toSearchParams(DEFAULT_FILTERS, 2).get('page')).toBe('2');
  });

  it('기간은 넣은 쪽만 적는다', () => {
    expect(toSearchParams(filters({ from: '2026-08-01' }), 1).toString()).toBe('from=2026-08-01');
    expect(toSearchParams(filters({ to: '2026-08-31' }), 1).toString()).toBe('to=2026-08-31');
  });

  it('공백만 친 검색어는 조건이 아니다', () => {
    expect(toSearchParams(filters({ q: '   ' }), 1).has('q')).toBe(false);
  });

  /*
   * **M04·M05의 뿌리** — `toSearchParams`가 고른 전표·라인을 만들지 않으므로
   * 조건 변경·초기화·쪽 이동이 그 둘을 함께 비운다(수명 표 1~3행).
   */
  it('고른 전표와 라인을 만들지 않는다', () => {
    const search = toSearchParams(filters({ supplier: '9101' }), 3);

    expect(search.has('ir')).toBe(false);
    expect(search.has('line')).toBe(false);
  });

  it('정수가 아닌 공급사는 주소에도 적지 않는다', () => {
    expect(toSearchParams(filters({ supplier: 'abc' }), 1).has('sup')).toBe(false);
  });
});

describe('toFilterQuery', () => {
  it('계약 쿼리 이름으로 옮긴다', () => {
    expect(
      toFilterQuery(
        filters({
          supplier: '9101',
          from: '2026-08-01',
          to: '2026-08-31',
          status: 'SAMPLE_IR_STATUS_A',
          q: 'IR-2026',
        }),
      ),
    ).toEqual({
      supplierId: 9101,
      receiptDateFrom: '2026-08-01',
      receiptDateTo: '2026-08-31',
      statusCode: 'SAMPLE_IR_STATUS_A',
      q: 'IR-2026',
    });
  });

  /* **M01의 단위 몫** — 빈 조건은 키 자체를 만들지 않는다. 요청 URL이 조건을 그대로 드러낸다. */
  it('빈 조건은 키를 만들지 않는다', () => {
    expect(toFilterQuery(DEFAULT_FILTERS)).toEqual({});
  });

  it('공백만 친 검색어는 싣지 않는다', () => {
    expect(toFilterQuery(filters({ q: '  ' }))).toEqual({});
  });

  it('공급사는 숫자로 싣는다', () => {
    expect(toFilterQuery(filters({ supplier: '9101' })).supplierId).toBe(9101);
  });
});

describe('toFilterChips', () => {
  const names = { supplier: 'SAMPLE-SUP-01 · 합성 공급사 가' };

  it('걸린 조건마다 칩 하나를 낸다', () => {
    const chips = toFilterChips(
      filters({ supplier: '9101', from: '2026-08-01', to: '2026-08-31', status: 'A', q: 'IR' }),
      names,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['supplier', 'period', 'status', 'q']);
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, names)).toEqual([]);
  });

  /* **#44** — 이 모듈이 번호를 문구로 바꾸지 않는다. 이름은 화면이 풀어 넘긴다. */
  it('공급사 칩에 이름을 담고 번호를 담지 않는다', () => {
    const chip = toFilterChips(filters({ supplier: '9101' }), names)[0];

    expect(chip?.label).toBe(t.filters.chipSupplier(names.supplier));
    expect(chip?.label).not.toContain('9101');
  });

  it('한쪽만 넣은 기간도 칩이 되고 문구가 갈린다', () => {
    const both = toFilterChips(filters({ from: '2026-08-01', to: '2026-08-31' }), names)[0];
    const fromOnly = toFilterChips(filters({ from: '2026-08-01' }), names)[0];
    const toOnly = toFilterChips(filters({ to: '2026-08-31' }), names)[0];

    expect(both?.label).toBe(t.filters.chipPeriodBoth('2026-08-01', '2026-08-31'));
    expect(fromOnly?.label).toBe(t.filters.chipPeriodFrom('2026-08-01'));
    expect(toOnly?.label).toBe(t.filters.chipPeriodTo('2026-08-31'));
  });

  /*
   * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 갈리면 손으로 고친 주소에서
   * 조건은 걸리지 않는데 칩만 떠, 결과가 그대로인 이유를 화면 어디에서도 읽을 수 없다.
   */
  it('요청에 실리지 않는 값은 칩도 되지 않는다', () => {
    expect(toFilterChips(filters({ supplier: 'abc', from: '2026-13-01', q: '  ' }), names)).toEqual(
      [],
    );
  });

  it('제거 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({ supplier: '9101', from: '2026-08-01', status: 'A', q: 'IR' }),
      names,
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('clearFilter', () => {
  it('그 조건 하나만 푼다', () => {
    const next = clearFilter(filters({ supplier: '9101', q: 'IR' }), 'supplier');

    expect(next.supplier).toBe('');
    expect(next.q).toBe('IR');
  });

  /* 기간 칩은 하나인데 조건은 둘이다 — 한쪽만 풀면 칩을 지웠는데 조건이 남는다. */
  it('기간은 시작과 종료를 함께 푼다', () => {
    const next = clearFilter(filters({ from: '2026-08-01', to: '2026-08-31' }), 'period');

    expect(next.from).toBe('');
    expect(next.to).toBe('');
  });
});
