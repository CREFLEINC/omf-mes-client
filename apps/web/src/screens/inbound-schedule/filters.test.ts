import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  hasAnyFilter,
  readFilters,
  readPage,
  readSelectedId,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type AsnFilters,
} from './filters';

const t = messages.inboundSchedule;

const EMPTY_PERIOD = { from: '', to: '' };

/** 조건 칩의 참조 이름은 화면이 이름으로 풀어 넘긴다 — 이 모듈은 번호를 문구로 만들지 않는다. */
const NAMES = { supplier: '합성 공급사 가', item: '합성 품목 가' };

const filters = (overrides: Partial<AsnFilters> = {}): AsnFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe('readFilters', () => {
  it('주소의 조건을 그대로 읽는다', () => {
    expect(
      readFilters(new URLSearchParams('supplier=8101&status=SAMPLE_STATUS_A&item=8301&q=ASN')),
    ).toEqual({ supplier: '8101', status: 'SAMPLE_STATUS_A', item: '8301', q: 'ASN' });
  });

  it('키가 없으면 빈 조건이다', () => {
    expect(readFilters(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
  });

  /*
   * **정수가 아닌 번호는 조건으로 받지 않는다.** 그대로 보내면 조회 전체가 400으로 실패해
   * 사용자에게는 「조회가 늘 안 된다」로만 보인다. 주소를 손으로 고친 경우가 이 자리다.
   */
  it.each(['abc', '8101.5', '-1', '', ' ', '8101a'])(
    '정수가 아닌 공급사 번호(%s)는 버린다',
    (raw) => {
      expect(readFilters(new URLSearchParams(`supplier=${raw}`)).supplier).toBe('');
    },
  );

  it.each(['abc', '1e3', '-2'])('정수가 아닌 품목 번호(%s)는 버린다', (raw) => {
    expect(readFilters(new URLSearchParams(`item=${raw}`)).item).toBe('');
  });

  /* 상태 코드와 검색어는 자유 문자열이라 형태로 거르지 않는다. */
  it('상태와 검색어는 문자열 그대로 받는다', () => {
    expect(readFilters(new URLSearchParams('status=%EA%B0%80&q=%EB%82%98'))).toMatchObject({
      status: '가',
      q: '나',
    });
  });
});

describe('readPage', () => {
  it('주소의 쪽 번호를 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });

  it.each(['0', '-1', 'abc', '', '1.5'])('이상한 쪽 번호(%s)는 첫 쪽으로 본다', (raw) => {
    expect(readPage(new URLSearchParams(`page=${raw}`))).toBe(1);
  });

  it('키가 없으면 첫 쪽이다', () => {
    expect(readPage(new URLSearchParams(''))).toBe(1);
  });
});

describe('readSelectedId', () => {
  it('고른 건의 번호를 읽는다', () => {
    expect(readSelectedId(new URLSearchParams('sel=7001'))).toBe(7001);
  });

  it.each(['xyz', '0', '-3', '', '70.5'])('이상한 값(%s)은 고르지 않은 것으로 본다', (raw) => {
    expect(readSelectedId(new URLSearchParams(`sel=${raw}`))).toBeNull();
  });

  it('키가 없으면 고르지 않은 것이다', () => {
    expect(readSelectedId(new URLSearchParams(''))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 적는다', () => {
    const params = toSearchParams(EMPTY_PERIOD, filters({ status: 'SAMPLE_STATUS_A' }), 1);

    expect(params.toString()).toBe('status=SAMPLE_STATUS_A');
  });

  /*
   * **기본 기간을 심지 않는다.** 심으면 「기간이 필수」로 읽히고, 필수가 아니라는 사실이
   * 화면에서 사라진다(이슈 #20 §6).
   */
  it('조건이 하나도 없으면 주소가 비어 있다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, 1).toString()).toBe('');
  });

  it('기간을 채우면 두 키가 적힌다', () => {
    const params = toSearchParams({ from: '2026-08-01', to: '2026-08-31' }, EMPTY_FILTERS, 1);

    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
  });

  it('기간 한쪽만 채우면 그 키만 적힌다', () => {
    expect(toSearchParams({ from: '2026-08-01', to: '' }, EMPTY_FILTERS, 1).toString()).toBe(
      'from=2026-08-01',
    );
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽이면 page를 적지 않는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, 1).has('page')).toBe(false);
  });

  it('둘째 쪽부터는 page를 적는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, EMPTY_FILTERS, 2).get('page')).toBe('2');
  });

  /*
   * **`sel`을 만들지 않는다.** 조건·쪽이 바뀌면 그 건이 새 결과에 없을 수 있어 함께 비워져야 하고,
   * 고르는 쪽만 이 결과에 `sel`을 덧붙인다(수명 규칙 1·2·3행이 여기서 함께 지켜진다).
   */
  it('sel을 만들지 않는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, filters({ status: 'A' }), 3).has('sel')).toBe(false);
  });

  it('정수가 아닌 번호는 주소에도 적지 않는다', () => {
    expect(
      toSearchParams(EMPTY_PERIOD, filters({ supplier: 'abc', item: '1.5' }), 1).toString(),
    ).toBe('');
  });

  /* 공백만 친 검색어는 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
  it('공백만 있는 검색어는 적지 않고, 앞뒤 공백은 다듬는다', () => {
    expect(toSearchParams(EMPTY_PERIOD, filters({ q: '   ' }), 1).toString()).toBe('');
    expect(toSearchParams(EMPTY_PERIOD, filters({ q: ' ASN ' }), 1).get('q')).toBe('ASN');
  });
});

describe('toFilterQuery', () => {
  it('채운 조건만 계약 쿼리 이름으로 옮긴다', () => {
    expect(
      toFilterQuery(
        filters({ supplier: '8101', status: 'SAMPLE_STATUS_A', item: '8301', q: 'ASN' }),
      ),
    ).toEqual({ supplierId: 8101, statusCode: 'SAMPLE_STATUS_A', itemId: 8301, q: 'ASN' });
  });

  it('빈 조건은 키를 만들지 않는다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  /* `Number('abc')`는 `NaN`이고, 그대로 실으면 요청 URL에 `supplierId=NaN`이 붙는다. */
  it('정수가 아닌 번호는 실리지 않는다 — NaN을 만들지 않는다', () => {
    expect(toFilterQuery(filters({ supplier: 'abc', item: '' }))).toEqual({});
  });

  it('검색어의 앞뒤 공백을 다듬고 공백만이면 싣지 않는다', () => {
    expect(toFilterQuery(filters({ q: ' ASN ' }))).toEqual({ q: 'ASN' });
    expect(toFilterQuery(filters({ q: '  ' }))).toEqual({});
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나를 만든다', () => {
    const chips = toFilterChips(
      filters({ supplier: '8101', status: 'SAMPLE_STATUS_A', item: '8301', q: 'ASN' }),
      NAMES,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['supplier', 'status', 'item', 'q']);
  });

  it('걸리지 않은 조건은 칩을 만들지 않는다', () => {
    expect(toFilterChips(EMPTY_FILTERS, NAMES)).toEqual([]);
  });

  /*
   * **내부 번호를 칩 문구에 내지 않는다**(#44). 화면이 이름으로 풀어 넘긴 값만 쓴다 —
   * 이 모듈에 번호를 문자열로 만드는 자리가 없어야 그 규칙이 구조로 지켜진다.
   */
  it('공급사·품목 칩에 번호가 아니라 넘겨받은 이름이 실린다', () => {
    const chips = toFilterChips(filters({ supplier: '8101', item: '8301' }), NAMES);

    expect(chips[0]?.label).toBe(t.filters.chipSupplier('합성 공급사 가'));
    expect(chips[1]?.label).toBe(t.filters.chipItem('합성 품목 가'));
    expect(chips.map((chip) => chip.label).join(' ')).not.toContain('8101');
    expect(chips.map((chip) => chip.label).join(' ')).not.toContain('8301');
  });

  it('상태·검색어 칩은 값을 그대로 낸다', () => {
    const chips = toFilterChips(filters({ status: 'SAMPLE_STATUS_A', q: 'ASN' }), NAMES);

    expect(chips[0]?.label).toBe(t.filters.chipStatus('SAMPLE_STATUS_A'));
    expect(chips[1]?.label).toBe(t.filters.chipQ('ASN'));
  });

  /* 「제거」가 넷이면 어느 조건을 푸는 것인지 알 수 없다. */
  it('제거 버튼의 접근 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filters({ supplier: '8101', status: 'A', item: '8301', q: 'ASN' }),
      NAMES,
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('hasAnyFilter', () => {
  it('조건이 하나라도 있으면 참이다', () => {
    expect(hasAnyFilter(filters({ q: 'ASN' }))).toBe(true);
  });

  it('조건이 하나도 없으면 거짓이다', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
  });
});
