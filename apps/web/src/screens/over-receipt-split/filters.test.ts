import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedPoId,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type PoFilters,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<PoFilters> = {}): PoFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

describe('readFilters — 주소에서 조건을 읽는다', () => {
  it('빈 주소는 기본 조건이다 — 미완료만이 켜져 있다', () => {
    expect(readFilters(params(''))).toEqual({ supplier: '', q: '', openOnly: true });
  });

  it('공급사와 검색어를 그대로 읽는다', () => {
    expect(readFilters(params('sup=9101&q=PO-2026-9'))).toEqual({
      supplier: '9101',
      q: 'PO-2026-9',
      openOnly: true,
    });
  });

  /*
   * **끔일 때만 주소에 적는다.** 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다 —
   * `open=1`이 붙은 것과 붙지 않은 것이 같은 결과를 내면 공유된 주소가 서로 달라 보인다.
   */
  it('open=0이면 미완료만이 꺼진다', () => {
    expect(readFilters(params('open=0')).openOnly).toBe(false);
  });

  /* 주소는 손으로 고쳐지는 자리다. 알 수 없는 값은 기본(켬)으로 본다. */
  it('open이 0이 아닌 알 수 없는 값이면 켬으로 본다', () => {
    expect(readFilters(params('open=1')).openOnly).toBe(true);
    expect(readFilters(params('open=abc')).openOnly).toBe(true);
    expect(readFilters(params('open=')).openOnly).toBe(true);
  });

  /*
   * **M06** — 정수가 아닌 번호를 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
   * 조회 전체가 400으로 실패하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 공급사 번호는 조건으로 받지 않는다', () => {
    expect(readFilters(params('sup=abc')).supplier).toBe('');
    expect(readFilters(params('sup=1.5')).supplier).toBe('');
    expect(readFilters(params('sup=-3')).supplier).toBe('');
    expect(readFilters(params('sup=')).supplier).toBe('');
  });
});

describe('readPage — 쪽 번호', () => {
  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('정수 쪽 번호를 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  /* 주소를 손으로 고친 경우다. 이상한 값은 첫 쪽으로 본다. */
  it('0·음수·정수가 아닌 값은 첫 쪽으로 본다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-1'))).toBe(1);
    expect(readPage(params('page=2.5'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
  });
});

describe('readSelectedPoId — 고른 발주', () => {
  it('고르지 않았으면 null이다', () => {
    expect(readSelectedPoId(params(''))).toBeNull();
  });

  it('정수 번호를 읽는다', () => {
    expect(readSelectedPoId(params('po=9001'))).toBe(9001);
  });

  it('정수가 아닌 값은 고르지 않은 것으로 본다', () => {
    expect(readSelectedPoId(params('po=xyz'))).toBeNull();
    expect(readSelectedPoId(params('po=0'))).toBeNull();
    expect(readSelectedPoId(params('po=-1'))).toBeNull();
  });
});

describe('toSearchParams — 조건을 주소로 옮긴다', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).toString()).toBe('');
  });

  it('채운 조건만 주소에 적는다', () => {
    expect(toSearchParams(filters({ supplier: '9101', q: 'PO-2026-9' }), 2).toString()).toBe(
      'sup=9101&q=PO-2026-9&page=2',
    );
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽과 켜진 미완료만은 주소에 적지 않는다', () => {
    const search = toSearchParams(filters({ openOnly: true }), 1);

    expect(search.has('page')).toBe(false);
    expect(search.has('open')).toBe(false);
  });

  it('미완료만을 끄면 open=0을 적는다', () => {
    expect(toSearchParams(filters({ openOnly: false }), 1).get('open')).toBe('0');
  });

  it('공백만 친 검색어는 조건이 아니다', () => {
    expect(toSearchParams(filters({ q: '   ' }), 1).has('q')).toBe(false);
  });

  /*
   * **M04 · M05의 절반이 여기 있다** — 조건·쪽이 바뀌면 고른 발주는 새 결과에 없을 수 있어
   * 함께 비워져야 한다. 이 함수가 `po`를 만들지 않는 것으로 수명 표 1·2·3행이 함께 지켜지고,
   * 고르는 쪽만 이 결과에 `po`를 덧붙인다.
   */
  it('고른 발주(po)를 만들지 않는다', () => {
    expect(toSearchParams(filters({ supplier: '9101' }), 3).has('po')).toBe(false);
  });

  it('정수가 아닌 공급사 번호는 주소에도 남기지 않는다', () => {
    expect(toSearchParams(filters({ supplier: 'abc' }), 1).has('sup')).toBe(false);
  });
});

describe('toFilterQuery — 계약이 쓰는 쿼리 이름', () => {
  /*
   * **M01** — 계약 기본이 `false`라 싣지 않으면 이미 입하가 끝난 발주까지 온다.
   * 이 화면의 대상은 아직 받을 것이 남은 발주다.
   */
  it('미완료만이 켜져 있으면 openOnly=true를 싣는다', () => {
    expect(toFilterQuery(DEFAULT_FILTERS)).toEqual({ openOnly: true });
  });

  /* 끄면 싣지 않는다 — 계약 기본이 `false`라 보내는 것과 결과가 같고 URL이 짧아진다. */
  it('미완료만을 끄면 openOnly를 싣지 않는다', () => {
    expect(toFilterQuery(filters({ openOnly: false }))).toEqual({});
  });

  it('공급사는 숫자로, 검색어는 다듬어 싣는다', () => {
    expect(toFilterQuery(filters({ supplier: '9101', q: '  PO-2026-9  ' }))).toEqual({
      supplierId: 9101,
      q: 'PO-2026-9',
      openOnly: true,
    });
  });

  it('정수가 아닌 공급사 번호는 요청에 실리지 않는다', () => {
    expect(toFilterQuery(filters({ supplier: '1.5' })).supplierId).toBeUndefined();
  });
});

describe('toFilterChips — 적용된 조건 칩', () => {
  it('걸린 조건만 칩이 된다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, { supplier: '' })).toEqual([]);
    expect(
      toFilterChips(filters({ supplier: '9101', q: 'PO-2026-9' }), {
        supplier: 'SAMPLE-SUP-01 · 합성 공급사 가',
      }).map((chip) => chip.key),
    ).toEqual(['supplier', 'q']);
  });

  /*
   * **번호를 문구로 만드는 자리를 이 모듈에 두지 않는다**(#44).
   * 화면이 이름으로 풀어 넘기고, 칩은 받은 이름을 그대로 담는다.
   */
  it('공급사 칩은 넘겨받은 이름을 담고 번호를 담지 않는다', () => {
    const [chip] = toFilterChips(filters({ supplier: '9101' }), {
      supplier: 'SAMPLE-SUP-01 · 합성 공급사 가',
    });

    expect(chip?.label).toContain('SAMPLE-SUP-01 · 합성 공급사 가');
    expect(chip?.label).not.toContain('9101');
  });

  /* 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  it('칩마다 제거 버튼의 접근 이름이 서로 다르다', () => {
    const chips = toFilterChips(filters({ supplier: '9101', q: 'PO-2026-9' }), { supplier: '가' });

    expect(new Set(chips.map((chip) => chip.removeLabel)).size).toBe(chips.length);
  });
});
