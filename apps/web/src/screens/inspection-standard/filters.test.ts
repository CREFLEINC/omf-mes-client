import { describe, expect, it } from 'vitest';

import {
  hasAnyFilter,
  readFilters,
  readPage,
  toFilterChips,
  toListQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters', () => {
  it('없는 조건은 빈 값으로 읽는다', () => {
    expect(readFilters(params(''))).toEqual({
      q: '',
      inspectionTypeCode: '',
      includeInactive: false,
    });
  });

  it('주소의 조건을 그대로 읽는다', () => {
    expect(readFilters(params('q=SYN&type=IQC&inactive=1'))).toEqual({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      includeInactive: true,
    });
  });

  /* `inactive`는 1일 때만 켠다 — 다른 값이 켜짐으로 읽히면 주소를 손으로 고친 사람이 뜻을 잃는다. */
  it('inactive가 1이 아니면 꺼진 것으로 읽는다', () => {
    expect(readFilters(params('inactive=0')).includeInactive).toBe(false);
    expect(readFilters(params('inactive=true')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('정수면 그 쪽이다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  /* 주소는 사람이 손으로 고치는 자리다 — 이상한 값에 조회 전체가 실패하면 안 된다. */
  it('0·음수·정수가 아닌 값은 첫 쪽으로 본다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
    expect(readPage(params('page=2.5'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
  });
});

describe('toSearchParams', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(toSearchParams({ q: '', inspectionTypeCode: '', includeInactive: false }, 1).toString())
      .toBe('');
  });

  it('채운 조건만 싣는다', () => {
    const search = toSearchParams(
      { q: 'SYN', inspectionTypeCode: 'PQC', includeInactive: true },
      2,
    );

    expect(search.get('q')).toBe('SYN');
    expect(search.get('type')).toBe('PQC');
    expect(search.get('inactive')).toBe('1');
    expect(search.get('page')).toBe('2');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽이면 page를 적지 않고 미사용 포함이 꺼지면 inactive를 적지 않는다', () => {
    const search = toSearchParams({ q: 'SYN', inspectionTypeCode: '', includeInactive: false }, 1);

    expect(search.has('page')).toBe(false);
    expect(search.has('inactive')).toBe(false);
  });

  /*
   * 조건·쪽이 바뀌면 보이는 행이 달라진다 — 목록에 없는 기준의 폼이 우 칸에 남으면
   * 그것이 어디서 왔는지 알 수 없다. 새 주소를 처음부터 만들어 선택이 따라오지 못하게 한다.
   */
  it('선택(plan·ver)을 담지 않는다 — 조건이 바뀌면 선택이 사라져야 한다', () => {
    const search = toSearchParams({ q: 'SYN', inspectionTypeCode: '', includeInactive: false }, 3);

    expect(search.has('plan')).toBe(false);
    expect(search.has('ver')).toBe(false);
  });
});

describe('toListQuery', () => {
  it('빈 조건은 쿼리에 싣지 않는다', () => {
    expect(toListQuery({ q: '', inspectionTypeCode: '', includeInactive: false }, 1)).toEqual({});
  });

  /* 계약의 기본값이 false다 — 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('미사용 포함이 꺼져 있으면 includeInactive를 싣지 않는다', () => {
    const query = toListQuery({ q: 'SYN', inspectionTypeCode: '', includeInactive: false }, 1);

    expect(query).toEqual({ q: 'SYN' });
    expect('includeInactive' in query).toBe(false);
  });

  it('미사용 포함이 켜지면 true를 싣는다', () => {
    expect(
      toListQuery({ q: '', inspectionTypeCode: '', includeInactive: true }, 1).includeInactive,
    ).toBe(true);
  });

  it('첫 쪽이면 page를 싣지 않고 둘째 쪽부터 싣는다', () => {
    expect('page' in toListQuery(
      { q: '', inspectionTypeCode: '', includeInactive: false },
      1,
    )).toBe(false);
    expect(
      toListQuery({ q: '', inspectionTypeCode: '', includeInactive: false }, 4).page,
    ).toBe(4);
  });

  it('검사 유형은 계약 이름으로 옮긴다', () => {
    expect(
      toListQuery({ q: '', inspectionTypeCode: 'OQC', includeInactive: false }, 1)
        .inspectionTypeCode,
    ).toBe('OQC');
  });
});

describe('toFilterChips', () => {
  it('적용된 조건만 칩으로 낸다', () => {
    expect(toFilterChips({ q: '', inspectionTypeCode: '', includeInactive: false })).toEqual([]);
  });

  it('검색어·유형·미사용 포함이 각각 칩이 된다', () => {
    const chips = toFilterChips({ q: 'SYN', inspectionTypeCode: 'IQC', includeInactive: true });

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'inspectionTypeCode', 'includeInactive']);
    expect(chips[0]?.label).toBe('검색어: SYN');
    expect(chips[1]?.label).toBe('검사 유형: IQC (수입검사)');
    expect(chips[2]?.label).toBe('미사용 포함');
  });

  /* 「제거」가 셋이면 어느 조건을 푸는 것인지 알 수 없다. */
  it('제거 라벨이 조건마다 다르다', () => {
    const chips = toFilterChips({ q: 'SYN', inspectionTypeCode: 'IQC', includeInactive: true });
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(3);
  });
});

describe('hasAnyFilter', () => {
  it('아무 조건도 없으면 거짓이다', () => {
    expect(hasAnyFilter({ q: '', inspectionTypeCode: '', includeInactive: false })).toBe(false);
  });

  it('미사용 포함만 켜져 있어도 참이다', () => {
    expect(hasAnyFilter({ q: '', inspectionTypeCode: '', includeInactive: true })).toBe(true);
  });
});
